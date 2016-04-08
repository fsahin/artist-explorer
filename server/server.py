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

@app.route('/spotify/artists')
def get_artists():
    ids = request.args.get('ids').split(',')
    response = sp.artists(ids)
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
    return jsonify(response)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)
