var audio = null;
var currentPlayingSongId = null;
var playMusic = true;
var numberOfArtistsToShow = 10;

var api = new SpotifyWebApi();

var showCompletion = true;
var volume = 0.5;

var server_base_path = "http://spartistexplorer.appspot.com/"

window.addEventListener('load', function() {
    var formArtist = document.getElementById('search-artist');
    formArtist.addEventListener('submit', function(e) {
        showCompletion = false;
        e.preventDefault();
        var search = document.getElementById('artist-search');
        api.searchArtists(search.value.trim(), function(err, data) {
            if (data.artists && data.artists.items.length) {
                initRootWithArtist(data.artists.items[0]);
            }
        });
    }, false);

    var formGenre = document.getElementById('search-genre');
    formGenre.addEventListener('submit', function(e) {
        showCompletion = false;
        e.preventDefault();
        var search = document.getElementById('genre-search');
        console.log("setting root genre")
        genreName = search.value.trim();
        initRootWithGenre(genreName);
    }, false);

}, false);

function qs(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function stripTrailingSlash(str) {
    if(str.substr(-1) == '/') {
        return str.substr(0, str.length - 1);
    }
    return str;
}

initArtistId = stripTrailingSlash(qs('artist_id'))
initGenre = stripTrailingSlash(qs('genre'))

if (initArtistId) {
    api.getArtist(initArtistId, function(error, data) {
        initRootWithArtist(data);
    });
} else if (initGenre) {
    initRootWithGenre(initGenre);
} else {
    api.getArtist('43ZHCT0cAZBISjO8DG9PnE', function(error, data) {
        initRootWithArtist(data);
    });
}

var allGenres = [];

loadAllGenres();

function initRootWithArtist(artist) {
    dndTree.setRoot(artist);
    $('#genre-search').val('')
}

function initRootWithGenre(genre) {
    dndTree.setRootGenre(genre);
    $('#artist-search').val('')
}

function loadAllGenres() {
    $.ajax({
        url: server_base_path + "genres"
    }).done(function(data) {
        data.genres.forEach(function(genre){
            allGenres.push(toTitleCase(genre.name));
        });
    });
}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

var getInfoTimeoutid;
function getInfo(artist) {
    getInfoTimeoutid = window.setTimeout(function(){
        _getInfo(artist);
    }, 500);
}

function getInfoCancel(artist) {
    window.clearTimeout(getInfoTimeoutid);
}

function setBioVisibility(val) {
    if (val) {
        $('#biography').show()
        $('#biography-label').show()
    } else {
        $('#biography').hide()
        $('#biography-label').hide()
    }
}

function setGenresVisibility(val) {
    if (val) {
        $('#mainGenres').show()
        $('#main-genres-label').show()
    } else {
        $('#mainGenres').hide()
        $('#main-genres-label').hide()
    }
}

function setGenreVisibility() {

}

function _getInfo(artist) {

    playForArtist(artist);
    $('#infobox').css("visibility", "visible")
    $('#hoverwarning').css("display", "none")

    $('#artistName').text(artist.name);
    $('#artistName').attr("href", artist['external_urls']['spotify']);
    $('#artistName').attr("target", "_blank");

    drawChart(artist.popularity);
    $.ajax({
        url: server_base_path + "artist-info/" + artist.uri
    }).done(function(data) {
        var found = false;
        data.artist.biographies.forEach(function(biography){
            if (!biography.truncated && !found) {
                $('#biography').text(biography.text);
                found = true;
                setBioVisibility(true);
            }
        });

        if (found === false) {
            setBioVisibility(false);
        }

        $("#mainGenres").empty();
        if (!data.artist.genres || data.artist.genres.length == 0) {
            setGenresVisibility(false);
        } else {
            setGenresVisibility(true);
        }
        data.artist.genres.forEach(function(genre) {
            $("#mainGenres").append("<li><a>" + toTitleCase(genre.name) + "</a></li>");
        });
        $('#mainGenres li').click( function() {
            initRootWithGenre($(this).text());
        } );
    });

    $.ajax({
      url: "https://api.spotify.com/v1/artists/"
      + artist.id
      + "/top-tracks?country=SE",
    }).done(function(data) {
        $("#popularTracks").empty();
        data.tracks.forEach(function(track, i){
            var className = "now-playing";
            if (i === 0 && playMusic) {
                className += " active";
            }

            $("#popularTracks")
                .append('<li class="' + className +'" onmouseover="playFromList(this)" onmouseout="playFromListCancel()" data-track-id='
                        + track.id + " data-preview-url=" + track.preview_url + ">"
                        + '<a target="_blank" href="'+ track['external_urls']['spotify'] + '">' + track.name + '</a>'
                        + "</li>");
        });
    });
}


function getRelated(artistId, n) {
    return new Promise(function(resolve, reject) {
        return api.getArtistRelatedArtists(artistId, function(error, data) {

            //Sort in popularity order
            resolve(data.artists.sort(function(a, b) {
                return b.popularity - a.popularity;
            }).slice(0, n));
            // resolve(data.artists.slice(0, n));
      });
    });
}


function getIdFromArtistUri(artistUri) {
    return artistUri.split(':').pop();
}

function getArtistsForGenre(genreName, n) {
    return new Promise(function(resolve, reject) {
        return $.ajax({
            url: server_base_path + "genres/" + encodeURIComponent(genreName.toLowerCase()) + "/artists"
        }).then(function(data) {
            var idsToRequest = []
            data.artists.forEach(function(artist) {
                if (artist.foreign_ids) {
                    idsToRequest.push(getIdFromArtistUri(artist.foreign_ids[0].foreign_id));
                }
            });
            return api.getArtists(idsToRequest, function(error, data) {
                //Sort in popularity order
                resolve(data.artists.sort(function(a, b) {
                    return b.popularity - a.popularity;
                }).slice(0, n));
            });
        });
    });
}


function changeNumberOfArtists(value) {
    numberOfArtistsToShow = value;
    document.getElementById("range-indicator").innerHTML = value;
}

function getSmallestLargerThan64ImageUrl(artist) {
    var size = artist.images.length;
    var image;
    for (i = size - 1; i >= 0; i --) {
        image = artist.images[i];
        if (image && image.height > 64 && image.width > 64) {
            return image.url;
        }
    }
}

function createAutoCompleteDiv(artist) {
    if (!artist) {
        return
    }
    var val =
    '<div class="autocomplete-item">'
        + '<div class="artist-icon-container">'
        +      '<img src="' + getSmallestLargerThan64ImageUrl(artist) + '" class="circular artist-icon" />'
        +      '<div class="artist-label">' + artist.name  + '</div>'
        + '</div>'
    + '</div>'
    return val;
}

$(function() {
    $("#artist-search")
        // don't navigate away from the field on tab when selecting an item
        .bind("keydown", function(event) {
            showCompletion = true;
            if (event.keyCode === $.ui.keyCode.TAB &&
                $(this).autocomplete("instance").menu.active) {
                event.preventDefault();
            }
        })
        .autocomplete({
            minLength: 0,
            source: function(request, response) {
                api.searchArtists(request.term + '*', {'limit': 50}, function(err, data) {
                    if (data.artists && data.artists.items.length) {
                        res = []
                        data.artists.items.forEach(function(artist) {
                            res.push(artist);
                        });
                        if (showCompletion) {
                            response(res)
                        } else {
                            response([]);
                        }
                    }
                });
            },
            focus: function() {
                // prevent value inserted on focus
                return false;
            },
            select: function(event, ui) {
                $("#artist-search").val(ui.item.name);
                initRootWithArtist(ui.item);
                return false;
            }
        })
        .autocomplete("instance")._renderItem = function(ul, item) {
            if (!item) {
                console.log("no item");
                return;
            }
            return $( "<li></li>" )
            .data( "item.autocomplete", item )
            .append(createAutoCompleteDiv(item))
            .appendTo( ul );
        };

    $("#genre-search")
        // don't navigate away from the field on tab when selecting an item
        .bind("keydown", function(event) {
            showCompletion = true;
            if (event.keyCode === $.ui.keyCode.TAB &&
                $(this).autocomplete("instance").menu.active) {
                event.preventDefault();
            }
            if (event.keyCode == 13) {
                $(".ui-menu-item").hide();
            }
        })
        .autocomplete({
            minLength: 0,
            source: function(request, response) {
                if (showCompletion) {
                    response($.ui.autocomplete.filter(allGenres, request.term));
                } else {
                    response([]);
                }
            },
            focus: function(e, ui) {
                // prevent value inserted on focus
                return false;
            },
            select: function(event, ui) {
                $("#genre-search").val(ui.item.value);
                initRootWithGenre(ui.item.value);
                return false;
            }
        });
});

function setDefaultPopularTracks() {
    $("#popularTracks li").removeClass("active");
}

var playPopTrackTimeoutId;

function playFromList(obj) {
    playPopTrackTimeoutId = window.setTimeout(function(){
        _playFromList(obj)
    }, 500);
}

function playFromListCancel() {
    window.clearTimeout(playPopTrackTimeoutId);
}

function _playFromList(obj) {
    setDefaultPopularTracks();
    if (!playMusic) {
        return;
    }
    $(obj).addClass("now-playing active");

    var trackId = obj.getAttribute("data-track-id");
    var previewUrl = obj.getAttribute("data-preview-url");
    trac = {
        "id": trackId,
        "preview_url": previewUrl,
    }
    playForTrack(trac);
}

//No need for this after setting volume
function playMusicHandler() {
    if (document.getElementById('playMusic').checked) {
        playMusic = true;
    } else {
        playMusic = false;
        clearMusic();
    }
}

function setVolume(vol) {
    volume = vol;
    audio.volume = vol;
}

function playForTrack(track_to_play) {
    if (!playMusic) {
        return;
    }

    if (currentPlayingSongId == track_to_play.id) {
        return;
    }
    if (currentPlayingSongId != null) {
        audio.setAttribute('src', track_to_play.preview_url);
        audio.load();
        audio.play();
    } else {
        audio = new Audio(track_to_play.preview_url);
        audio.volume = volume;
        audio.load();
        audio.play();
    }
    currentPlayingSongId = track_to_play.id;
}

function clearMusic() {
    setDefaultPopularTracks();
    if (audio) {
        audio.pause();
    }
    currentPlayingSongId = null;

}

function playForArtist(artist) {
    api.getArtistTopTracks(artist.id, "SE").then(function(data) {
        var track_to_play = data.tracks[0];
        playForTrack(track_to_play);
    });
}