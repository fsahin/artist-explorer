var audio = null;
var currentPlayingSongId = null;
var playMusic = true;
var numberOfArtistsToShow = 10;

function playMusicHandler() {
    if (document.getElementById('playMusic').checked) {
        playMusic = true;
    } else {
        playMusic = false;
        clearMusic();
    }
}

function changeNumberOfArtists(value) {
    numberOfArtistsToShow = value;
    document.getElementById("range").innerHTML = value;
}

$(function() {
    var api = new SpotifyWebApi();
    $("#artist-search")
        // don't navigate away from the field on tab when selecting an item
        .bind("keydown", function(event) {
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
                api.searchArtists(request.term + '*', function(err, data) {
                    if (data.artists && data.artists.items.length) {
                        res = []
                        data.artists.items.forEach(function(artist) {
                            res.push(artist.name);
                        });
                        response(res);
                    }
                });
            },
            focus: function() {
                // prevent value inserted on focus
                return false;
            }
        });
});

var api = new SpotifyWebApi();

function setDefaultPopularTracks() {
    $("#popularTracks li").removeClass("active");
}

function playFromList(obj) {
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

function playForTrack(track_to_play) {
    console.log(playMusic);
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
        console.log("init sound");
        audio = new Audio(track_to_play.preview_url);
        audio.load();
        audio.play();
    }
    currentPlayingSongId = track_to_play.id;
}

function clearMusic() {
    setDefaultPopularTracks();
    console.log("clearing music");
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