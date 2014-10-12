// Get JSON data

(function() {
    'use strict';
    var api = new SpotifyWebApi();

    // Misc. variables
    var i = 0;
    var duration = 750;
    var root;

    // size of the diagram
    var viewerWidth = $(window).width() - 370;
    var viewerHeight = $(window).height() - 120;

    var tree = d3.layout.tree()
        .size([viewerHeight, viewerWidth]);

    // define a d3 diagonal projection for use by the node paths later on.
    var diagonal = d3.svg.diagonal()
        .projection(function(d) {
            return [d.y, d.x];
        });

    // Define the zoom function for the zoomable tree

    function zoom() {
        svgGroup.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
    }

    // define the zoomListener which calls the zoom function on the "zoom" event constrained within the scaleExtents
    var zoomListener = d3.behavior.zoom().scaleExtent([0.1, 3]).on("zoom", zoom);


    // define the baseSvg, attaching a class for styling and the zoomListener
    var baseSvg = d3.select("#tree-container").append("svg")
        .attr("width", viewerWidth)
        .attr("height", viewerHeight)
        .attr("class", "overlay")
        .call(zoomListener);

    function updateWindow(){
        viewerWidth = $(window).width() - 370;
        viewerHeight = $(window).height() - 120;
        baseSvg.attr("width", viewerWidth).attr("height", viewerHeight);
    }
    window.onresize = updateWindow;

    // Function to center node when clicked/dropped so node doesn't get lost when collapsing/moving with large amount of children.
    function centerNode(source) {
        var scale = zoomListener.scale();
        var x = -source.y0;
        var y = -source.x0;
        x = x * scale + viewerWidth / 2;
        y = y * scale + viewerHeight / 2;
        d3.select('#tree-container g').transition()
            .duration(duration)
            .attr("transform", "translate(" + x + "," + y + ")scale(" + scale + ")");
        zoomListener.scale(scale);
        zoomListener.translate([x, y]);
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

    function setChildrenAndUpdate(node) {
        var artists;

        getRelated(node.artist.id, numberOfArtistsToShow).then(function(artists) {
            if (!node.children) {
                node.children = []
            }

            artists.forEach(function(artist) {
                node.children.push(
                    {
                        'artist': artist,
                        'children': null
                    }
                )
            });
            update(node);
            centerNode(node);
        });
    }

    function initWithArtist(artist) {
        return {
            'artist' : artist,
            'children': null,
        }
    };

    // Toggle children function
    function toggleChildren(d) {
        if (d.children) {
            d.children = null;
            update(d);
            centerNode(d);
        } else {
            setChildrenAndUpdate(d);
        }
        return d;
    }

    // Toggle children on click.

    function click(d) {
        if (d3.event.defaultPrevented) return; // click suppressed
        d = toggleChildren(d);
    }

    function toTitleCase(str) {
        return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
    }

    function getInfo(d) {
        playForArtist(d.artist);
        $('#infobox').css("visibility", "visible")
        $('#hoverwarning').css("display", "none")
        $('#artistInfo').text(d.artist.name);
        drawChart(d.artist.popularity);
        $.ajax({
            url: "https://developer.echonest.com/api/v4/artist/profile?api_key=74YUTJPKNBURV2BLX%20&id="
            + d.artist.uri
            + "&bucket=genre&bucket=biographies&format=json",
        }).done(function(data) {
            var found = false;
            data.response.artist.biographies.forEach(function(biography){
                if (!biography.truncated && !found) {
                    $('#biography').text(biography.text);
                    found = true;
                }
            });

            $("#mainGenres").empty();
            data.response.artist.genres.forEach(function(genre) {
                $("#mainGenres").append("<li>" + toTitleCase(genre.name) + "</li>");
            });
        });

        $.ajax({
          url: "https://api.spotify.com/v1/artists/"
          + d.artist.id
          + "/top-tracks?country=SE",
        }).done(function(data) {
            $("#popularTracks").empty();
            data.tracks.forEach(function(track, i){
                var className = "now-playing";
                console.log("playMusic", playMusic);
                if (i === 0 && playMusic) {
                    className += " active";
                }

                $("#popularTracks")
                    .append('<li class="' + className +'" onmouseover="playFromList(this)" data-track-id='
                            + track.id + " data-preview-url=" + track.preview_url +">"
                            + track.name +
                            "</li>");
            });
        });
    }

    function clearLabel(d) {
        console.log("hover clear");
    }

    function update(source) {
        // Compute the new height, function counts total children of root node and sets tree height accordingly.
        // This prevents the layout looking squashed when new nodes are made visible or looking sparse when nodes are removed
        // This makes the layout more consistent.
        var levelWidth = [1];
        var childCount = function(level, n) {
            if (n.children && n.children.length > 0) {
                if (levelWidth.length <= level + 1) levelWidth.push(0);

                levelWidth[level + 1] += n.children.length;
                n.children.forEach(function(d) {
                    childCount(level + 1, d);
                });
            }
        };

        childCount(0, root);
        var newHeight = d3.max(levelWidth) * 100; // 25 pixels per line
        tree = tree.size([newHeight, viewerWidth]);

        // Compute the new tree layout.
        var nodes = tree.nodes(root).reverse();
        var links = tree.links(nodes);

        // Set widths between levels based on maxLabelLength.
        nodes.forEach(function(d) {
            //d.y = (d.depth * (maxLabelLength * 10)); //maxLabelLength * 10px
            // alternatively to keep a fixed scale one can set a fixed depth per level
            // Normalize for fixed-depth by commenting out below line
             d.y = (d.depth * 220); //500px per level.
        });

        // Update the nodes…
        var node = svgGroup.selectAll("g.node")
            .data(nodes, function(d) {
                return d.id || (d.id = ++i);
            });

        // Enter any new nodes at the parent's previous position.
        var nodeEnter = node.enter().append("g")
            // .call(dragListener)
            .attr("class", "node")
            .attr("transform", function(d) {
                return "translate(" + source.y0 + "," + source.x0 + ")";
            })
            .on("mouseover", getInfo)
            // .on("mouseout", clearLabel)
            .on('click', click);

        nodeEnter.append("circle")
            .attr('class', 'nodeCircle')
            .attr("r", 32)
            .style("fill", function(d) {
                return d._children ? "black" : "#fff";
            });

        nodeEnter.append("text")
            .attr("x", function(d) {
                return 40;
            })
            .attr("dy", ".35em")
            .attr('class', 'nodeText')
            .attr("text-anchor", function(d) {
                return d.children || d._children ? "end" : "start";
            })
            .text(function(d) {
                return d.artist.name;
            })
            .style("fill-opacity", 0);

        nodeEnter.append("clipPath")
            .attr("cx", "0")
            .attr("cy", "0")
            .attr("r", "50")
            .attr("id", "clipCircle")
                .append("circle")
                .attr("r", 32);


         nodeEnter.append("image")
            .attr("xlink:href", function(d) {
              if (d.artist.images[1]) {
                return d.artist.images[1].url;
              } else {
                return '';
              }
            })
            .attr("x", "-32px")
            .attr("y", "-32px")
            .attr("r", "32")
            .attr("clip-path", "url(#clipCircle)")
            .attr("width",
              function(d) {
                  var image = d.artist.images[1];
                  if (!image) {
                    return 64;
                  }
                  if (image.width > image.height) {
                      return 64 * (image.width/image.height)
                  } else {
                      return 64;
                  }
              })
            .attr("height",
              function(d) {
                  var image = d.artist.images[1];
                  if (!image) {
                    return 64;
                  }
                  if (image.height > image.width) {
                      return 64 * (image.height/image.width)
                  } else {
                      return 64;
                  }
              })

        // Transition nodes to their new position.
        var nodeUpdate = node.transition()
            .duration(duration)
            .attr("transform", function(d) {
                return "translate(" + d.y + "," + d.x + ")";
            });

        // Fade the text in
        nodeUpdate.select("text")
            .style("fill-opacity", 1);

        // Transition exiting nodes to the parent's new position.
        var nodeExit = node.exit().transition()
            .duration(duration)
            .attr("transform", function(d) {
                return "translate(" + source.y + "," + source.x + ")";
            })
            .remove();

        // nodeExit.select("circle")
        //     .attr("r", 0);

        nodeExit.select("text")
            .style("fill-opacity", 0);

        // Update the links…
        var link = svgGroup.selectAll("path.link")
            .data(links, function(d) {
                return d.target.id;
            });

        // Enter any new links at the parent's previous position.
        link.enter().insert("path", "g")
            .attr("class", "link")
            .attr("d", function(d) {
                var o = {
                    x: source.x0,
                    y: source.y0
                };
                return diagonal({
                    source: o,
                    target: o
                });
            });

        // Transition links to their new position.
        link.transition()
            .duration(duration)
            .attr("d", diagonal);

        // Transition exiting nodes to the parent's new position.
        link.exit().transition()
            .duration(duration)
            .attr("d", function(d) {
                var o = {
                    x: source.x,
                    y: source.y
                };
                return diagonal({
                    source: o,
                    target: o
                });
            })
            .remove();

        // Stash the old positions for transition.
        nodes.forEach(function(d) {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    // Append a group which holds all nodes and which the zoom Listener can act upon.
    var svgGroup = baseSvg.append("g");

    api.searchArtists('Cake', function(err, data) {
        if (data.artists && data.artists.items.length) {
            root = initWithArtist(data.artists.items[0]);
            root.x0 = viewerHeight / 2;
            root.y0 = 0;
            update(root);
            centerNode(root);
        }
      });

    window.addEventListener('load', function() {

    var form = document.querySelector('form');
        form.addEventListener('submit', function(e) {
          e.preventDefault();
          var search = document.getElementById('artist-search');
          api.searchArtists(search.value.trim(), function(err, data) {
            if (data.artists && data.artists.items.length) {
              // search.value = '';
              root = initWithArtist(data.artists.items[0]);
              update(root);
              centerNode(root);
            }
          });

        }, false);
      }, false);

})();
