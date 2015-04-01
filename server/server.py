from flask import Flask, jsonify, request
from functools import  wraps
from flask_cors import CORS, cross_origin
from werkzeug.contrib.cache import SimpleCache
import pyen
import redis
import uuid
import time
from functools import update_wrapper
from flask import request, g
import zlib
import json
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials

cache = SimpleCache(threshold=20000)

app = Flask(__name__)

#Allowed origins
ORIGINS = ['*']

app.config['CORS_HEADERS'] = "Content-Type"
app.config['CORS_RESOURCES'] = {r"/*": {"origins": ORIGINS}}
app.config['PROPAGATE_EXCEPTIONS'] = True

cors = CORS(app)

# Make sure ECHO_NEST_API_KEY environment variable is set
en = pyen.Pyen()

client_credentials_manager = SpotifyClientCredentials()
sp = spotipy.Spotify(client_credentials_manager=client_credentials_manager)

r = redis.StrictRedis(host='localhost', port=6379, db=0)

class RateLimit(object):
    expiration_window = 10

    def __init__(self, key_prefix, limit, per, send_x_headers):
        self.reset = (int(time.time()) // per) * per + per
        self.key = key_prefix + str(self.reset)
        self.limit = limit
        self.per = per
        self.send_x_headers = send_x_headers
        p = r.pipeline()
        p.incr(self.key)
        p.expireat(self.key, self.reset + self.expiration_window)
        self.current = min(p.execute()[0], limit)

    remaining = property(lambda x: x.limit - x.current)
    over_limit = property(lambda x: x.current >= x.limit)

def get_view_rate_limit():
    return getattr(g, '_view_rate_limit', None)

def on_over_limit(limit):
    return 'You hit the rate limit', 400

def ratelimit(limit, per=300, send_x_headers=True,
              over_limit=on_over_limit,
              scope_func=lambda: request.remote_addr,
              key_func=lambda: request.endpoint):
    def decorator(f):
        def rate_limited(*args, **kwargs):
            key = 'rate-limit/%s/%s/' % (key_func(), scope_func())
            rlimit = RateLimit(key, limit, per, send_x_headers)
            g._view_rate_limit = rlimit
            if over_limit is not None and rlimit.over_limit:
                return over_limit(rlimit)
            return f(*args, **kwargs)
        return update_wrapper(rate_limited, f)
    return decorator

def cached(timeout=5 * 60, key='view/%s'):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            cache_key = key % request.path
            rv = cache.get(cache_key)
            if rv is not None:
                return rv
            rv = f(*args, **kwargs)
            cache.set(cache_key, rv, timeout=timeout)
            return rv
        return decorated_function
    return decorator


@app.route('/api/artist-info/<artist_uri>')
@cached(timeout=30 * 60)
def get_artist_info(artist_uri):
    echonest_response = en.get('artist/profile', id=artist_uri, bucket=['genre','biographies'])
    response = {}
    response['status'] = echonest_response['status']
    response['artist'] = {}
    response['artist']['genres'] = echonest_response['artist']['genres']
    for bio in echonest_response['artist']['biographies']:
        if ('truncated' not in bio) or bio['truncated'] == False:
            response['artist']['biographies'] = [bio]
            break

    return jsonify(response)

@app.route('/api/genres/<genre_name>/artists')
@cached(timeout=30 * 60)
def get_genre_artists(genre_name):
    response = en.get('genre/artists', name=genre_name, results=15, bucket=['id:spotify'], limit=True)
    return jsonify(response)

@app.route('/api/genres')
@cached(timeout=30 * 60)
def get_all_genres():
    response = en.get('genre/list', results=2000)
    return jsonify(response)

@app.route('/spotify/artists/<artist_id>')
def get_artist(artist_id):
    response = sp.artist(artist_id)
    return jsonify(response)

@app.route('/spotify/artists/<artist_id>/related-artists')
def get_related_artists(artist_id):
    response = sp.artist_related_artists(artist_id)
    return jsonify(response)

@app.route('/spotify/artists/<artist_id>/top-tracks')
def get_top_tracks(artist_id):
    country = request.args.get('country')
    response = sp.artist_top_tracks(artist_id, country)
    return jsonify(response)


@app.route('/spotify/search')
def search():
    q = request.args.get('q')
    type = request.args.get('type')
    limit = request.args.get('limit')

    response = sp.search(q, type=type, limit=limit)
    print response
    return jsonify(response)


@app.route('/api/savetree', methods=['POST'])
@ratelimit(limit=3, per=10) # 3 times in 10 secs
def save_entry():
    entry_id = str(uuid.uuid4()).replace('-', '')
    entry_data = request.form['entry_data']
    try:
        val = json.loads(entry_data)
    except:
        return "Not Ok", 400, {'Content-Type': 'text/css; charset=utf-8'}

    if 'children' not in val:
        return "Not Ok", 400, {'Content-Type': 'text/css; charset=utf-8'}

    compressed = zlib.compress(entry_data.encode('utf-8'))

    result = r.set(entry_id, compressed)
    if result:
        return entry_id, 200, {'Content-Type': 'text/css; charset=utf-8'}
    else:
        return "Not Ok", 500, {'Content-Type': 'text/css; charset=utf-8'}


@app.route('/api/entries/<entry_id>', methods=['GET'])
def get_entry(entry_id):
    result = zlib.decompress(r.get(entry_id)).decode('utf-8')
    return result

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)
