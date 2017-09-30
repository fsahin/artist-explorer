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

client_credentials_manager = SpotifyClientCredentials()
sp = spotipy.Spotify(client_credentials_manager=client_credentials_manager)


genres = {
    "genres": [ "acoustic", "afrobeat", "alt-rock", "alternative", "ambient", "anime", "black-metal", "bluegrass", "blues", "bossanova", "brazil", "breakbeat", "british", "cantopop", "chicago-house", "children", "chill", "classical", "club", "comedy", "country", "dance", "dancehall", "death-metal", "deep-house", "detroit-techno", "disco", "disney", "drum-and-bass", "dub", "dubstep", "edm", "electro", "electronic", "emo", "folk", "forro", "french", "funk", "garage", "german", "gospel", "goth", "grindcore", "groove", "grunge", "guitar", "happy", "hard-rock", "hardcore", "hardstyle", "heavy-metal", "hip-hop", "holidays", "honky-tonk", "house", "idm", "indian", "indie", "indie-pop", "industrial", "iranian", "j-dance", "j-idol", "j-pop", "j-rock", "jazz", "k-pop", "kids", "latin", "latino", "malay", "mandopop", "metal", "metal-misc", "metalcore", "minimal-techno", "movies", "mpb", "new-age", "new-release", "opera", "pagode", "party", "philippines-opm", "piano", "pop", "pop-film", "post-dubstep", "power-pop", "progressive-house", "psych-rock", "punk", "punk-rock", "r-n-b", "rainy-day", "reggae", "reggaeton", "road-trip", "rock", "rock-n-roll", "rockabilly", "romance", "sad", "salsa", "samba", "sertanejo", "show-tunes", "singer-songwriter", "ska", "sleep", "songwriter", "soul", "soundtracks", "spanish", "study", "summer", "swedish", "synth-pop", "tango", "techno", "trance", "trip-hop", "turkish", "work-out", "world-music" ]
}


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


@app.route('/api/genres/<genre_name>/artists')
@cached(timeout=30 * 60)
def get_genre_artists(genre_name):
    response = sp.recommendations(seed_genres=genre_name, limit=50)
    return jsonify(response)

@app.route('/api/genres')
@cached(timeout=30 * 60)
def get_all_genres():
    return jsonify(genres)

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
