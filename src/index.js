'use strict';

import * as d3 from 'd3';
import $ from 'jquery';
// import swipe from 'jquery-touchswipe';
import autocomplete from 'autocompleter';

let metadata;

/**
* Render image detail view for given image ID
*/
const showObj = (id) => {
  $('.obj-nav,.obj-ts').remove();

  const idx = metadata.id2idx[id];
  const ts = metadata.seq[idx] != undefined ? metadata.seq[idx].ts : undefined;

  $('#object-container')
    .css('background', `#222 url(/cache/${id}.jpg) no-repeat center center`)
    .css('background-size', 'contain');

  $('#object-container').append("<div class=\"obj-ts\">" + ts + "</div>");

  $('#object-container').append("<div id=\"dl-btn\" class=\"obj-nav\">D</div>");
  $('#dl-btn').click( e0 => {
    console.log("click")
    window.location.href = "/cache/" + id + ".jpg"
  });

  $('#object-container').append('<div id="idx-btn" class="obj-nav">x</div>');
  $('#idx-btn').click( (e0) => $('#object-container').hide());

  // handling of previous (more recent) object, if any
  const nextID = ((idx) => {
    return idx == 0 || idx == undefined ? undefined : metadata.seq[idx - 1].id; }
  )(idx);

  if(nextID != undefined){
    $('#object-container')
      .append('<div id="next-btn" class=\"obj-nav\">&gt;</div>');
    $('#next-btn').click( () => showObj(nextID));
  }

  // handling of next (older) object, if any
  const prevID = ((idx) => {
    return idx < metadata.seq.length -1 && idx != undefined ? metadata.seq[idx + 1].id : undefined; }
  )(idx);

  if(prevID != undefined){
    $('#object-container')
      .append('<div id="prev-btn" class=\"obj-nav\">&lt;</div>');
    $('#prev-btn').click( () => showObj(prevID));
  }

  $('#object-container').show();

  // key event handling
  document.onkeydown = (e) => {
    e = e || window.event;
    if (e.keyCode == '27') {
      $('#object-container').hide();
    }
    else if (e.keyCode == '37'
        && prevID != undefined) {
      showObj(prevID);
    }
    else if (e.keyCode == '39'
        && nextID != undefined) {
      showObj(nextID);
    }
  };

  //   // enable swiping...
  //   $("#overlay").swipe( {
  //     //Generic swipe handler for all directions
  //     swipe:function(event, direction, distance, duration, fingerCount, fingerData) {
  //       //console.log("You swiped " + direction );
  //       if (direction=='right'
  //           && prevObj != null) {
  //         prevObj.click();
  //       }
  //       else if (direction == 'left'
  //           && nextObj != null) {
  //         nextObj.click();
  //       }
  //     },
  //     //Default is 75px, set to 0 for demo so any distance triggers swipe
  //     threshold:0
  //   });

}

const refreshThumbs = (d) => {
  console.log(d);

  d3.selectAll('.thumb.next')
    .remove();
  if(d.next){
    d3.select('#thumbs-container').append('div')
      .attr('class', 'thumb next')
      .on('click', () => updateTimeline({gte:d.next.ts}))
      .text('<');
  }

  const thumbs = d3.select('#thumbs-container')
    .selectAll('.thumb.viewable')
    .data(d.seq, x => x.id);

  thumbs.enter()
    .append('div')
      .attr('class', 'thumb viewable')
      .append('img')
        .attr('src', d => `cache/thumbs/${d.id}.jpg`)
        .on('click', d => showObj(d.id));

  thumbs.exit()
    .remove();

  d3.selectAll('.thumb.prev')
    .remove();
  if(d.prev){
    d3.select('#thumbs-container').append('div')
      .attr('class', 'thumb prev')
      .on('click', () => updateTimeline({lte:d.prev.ts}))
      .text('>');
  }

}

const updateTimeline = (options={}) => {
  const q = ((options) => {
    if(options.hasOwnProperty('lte')){return '?lte=' + options.lte;}
    else if(options.hasOwnProperty('gte')){return '?gte=' + options.gte;}
    else{ return '';}
  })(options);

  d3.json('/api/timeline' + q)
    .then(d => {
      metadata = d;

      metadata.id2idx = {}

      metadata.seq.forEach((x, idx) => {
        metadata.id2idx[x.id] = idx;
      });

      refreshThumbs(d);
    })
    .catch(e => console.error(e))
};


if (document.getElementById("q") != null){

  // $('#search-box').click(() => {
  //   $('#search-box').empty();
  //   $('#search-box').append('<input id="q-input" type="search" />');
  //   $('#search-box').css('width', '298px');
  // });

  const submitSearch = () => d3.json(
      '/api/search?q=' + document.getElementById('q').value)
    .then(d => refreshThumbs({seq: d.map(x => ({id:x}) )}))
    .catch(e => console.error(e));

  autocomplete({
    input: document.getElementById("q"),
    fetch: (text, update) => {
      d3.json('/api/autocomplete?q=' + text.toLowerCase())
        .then(d => update(d.map(x => ({label:x}))))
        .catch(e => console.error(e));
    },
    onSelect: (item) => {
      document.getElementById('q').value = item.label;
      submitSearch();
    }
  });

  $('#search-form').submit((e) => {
    submitSearch();
    e.preventDefault();
  });

  document.querySelector('#q')
    .addEventListener('input', (e) => {
      if(e.target.value==''){
        refreshThumbs(metadata);
      }
    });
}


updateTimeline();
