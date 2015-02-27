var spAPI = function (serverBasePath) {

  var getArtistRelatedArtists = function(artistId) {
    var url = serverBasePath + '/spotify/artists/' + artistId + '/related-artists';
    return $.ajax({
        url: url
    })
  };

  var getArtistTopTracks = function(artistId, country) {
    var url = serverBasePath + '/spotify/artists/' + artistId + '/top-tracks';
    return $.ajax({
        url: url,
        data: {
            country: country
        }
    })
  };

  var getArtist = function(artistId) {
    var url = serverBasePath + '/spotify/artists/' + artistId;
    return $.ajax({
        url: url
    })
  };

  var searchArtists = function(q, params) {
    var url = serverBasePath + '/spotify/search';
    var data = params
    data['q'] = q
    data['type'] = 'artist'

    return $.ajax({
        url: url,
        data: data
    })
  };

  return {
    getArtistRelatedArtists: getArtistRelatedArtists,
    getArtist: getArtist,
    searchArtists: searchArtists,
    getArtistTopTracks: getArtistTopTracks
  }

};
