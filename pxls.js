'use strict';

const auth = require('basic-auth')
const chokidar = require('chokidar');
const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const glob = require('glob');
const gm = require('gm').subClass({imageMagick: true});
const level = require('level');
const moment = require('moment');
const path = require('path');
const si = require('search-index');

const unchunk = require('./src/unchunk.js')();
let text_analyzer;

// should be an absolute path
const DATA_PATH = (x => {
  const tmp_path = x? x : 'data';
  return path.resolve(tmp_path)
})(process.env.PXLS_DATA_PATH);
console.log('Data path: ' + DATA_PATH);

const MASTERS_PATH = path.join(DATA_PATH, 'masters');
if (!fs.existsSync(MASTERS_PATH)){
    fs.mkdirSync(MASTERS_PATH);
}
const CACHE_PATH = path.join(DATA_PATH, 'cache');
if (!fs.existsSync(CACHE_PATH)){
    fs.mkdirSync(CACHE_PATH);
}
const THUMBS_PATH = path.join(DATA_PATH, 'cache', 'thumbs');
if (!fs.existsSync(THUMBS_PATH)){
    fs.mkdirSync(THUMBS_PATH);
}

// File system locaion of original files
const MASTERS_GLOB = MASTERS_PATH + '/**/*.{JPG,jpg,jpeg,png,PNG}';
const ALLOWED_FILE_ENDINGS = '.jpeg,.jpg,.JPG,.JPEG,.png,.PNG';

// File system location of metadata
const OBJECTDB_PATH = path.join(DATA_PATH, 'objdb');
const HASH2OBJECTDB_PATH = path.join(DATA_PATH, 'hash2objdb');
const TS2OBJECTDB_PATH = path.join(DATA_PATH,'ts2objdb');
const WORD2OBJECTDB_PATH = path.join(DATA_PATH, 'word2objdb');

const MAX_GALLERY_SIZE = 100;

const ANALYZE_TEXT = process.env.PXLS_ANALYZE_TEXT == 1;
if(ANALYZE_TEXT){
  text_analyzer = require('./src/text_analyzer.js')
}

const objdb = level(
  OBJECTDB_PATH
  , {
    keyEncoding: 'binary',
    valueEncoding: 'json'
  }
);
const hashdb = level(HASH2OBJECTDB_PATH);
const tsdb = level(TS2OBJECTDB_PATH);
const wdb = si({ name: WORD2OBJECTDB_PATH });


let tasks = [];
let busy = false; //true if tasks are running


// queue task for asynchronous indexing of events/objects
function indexObj(master_path){
  if(ALLOWED_FILE_ENDINGS.indexOf(path.extname(master_path)) < 0){
    console.log('Skipping unknown file extension');
    return;
  }

  console.log('Adding task ' + master_path)
  tasks.push(master_path);

  indexNext();
}

// pick the next task to be processed or do nothing if another task is running
function indexNext(){

  if(tasks.length > 0 && !busy){
    var master_path = tasks.shift();

    busy = true;
    importObj(master_path);
  }
  else if(tasks.length == 0 && !busy){
    console.log('Indexing completed.');
  }
  //else{
  //  console.log('busy');
  //}
}


function importObj(master_path){

  console.log('Processing ' + master_path);

  const fhash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(master_path), 'utf8')
    .digest('hex');

  console.log('Hash: ' + fhash);

  hashdb.get(fhash, (err, value) => {
    if (err) {
      if (err.notFound) {

        const start = async () => {
          const metadata = await analyzeObj(master_path);
          metadata['hash'] = fhash;
          console.log(metadata);
          objdb.put(metadata.id, metadata)
            .then(x => {return hashdb.put(fhash, metadata.id)})
            .then(x => {return tsdb.put(metadata.ts, metadata.id)})
            .then(x => { return new Promise((resolve, reject) => {
              if(ANALYZE_TEXT && metadata.words.length > 0){
                const d = {id:metadata.id, words:metadata.words.join(' ')};
                wdb.PUT([d]).then(x => {resolve();})}
              else{
                resolve();
              }
            })
            })
            .then(x => {return indexNext()})
            .catch(e => console.error(e));
          busy = false;
        }
        start();

      }
      // I/O or other error, pass it up the callback chain
      // return callback(err)
    }
    else{
      console.log('Already analyzed / duplicate.');
      busy = false;
      indexNext();
    }
  })
}


// tramsform an image and extract information from an image
const analyzeObj = async(master_path) => {

  console.log('Analyzing ' + master_path);

  const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });

  console.log('New ID: ' + id)

  const make_thumb = new Promise((resolve, reject) => {
    gm(master_path)
      .resize(200, 200)
      .autoOrient()
      .gravity('Center')
      .crop(98,98)
      .noProfile()
      .write(path.join(THUMBS_PATH, id + '.jpg'), resolve);
  });
  await make_thumb;

  const path_1024 = path.join(CACHE_PATH, id + '.jpg');
  const make_1024 = new Promise((resolve, reject) => {
    gm(master_path)
      .autoOrient()
      .resize(null, 1024)
      .write(path_1024, resolve);
  });
  await make_1024;

  const gm_identify = new Promise((resolve, reject) => {
    gm(master_path)
      .identify((err, data) => {
        if(err !== null) reject(err);
        else resolve(data);
      });
  });
  const data = await gm_identify;

  // 'exif:DateTime' 'exif:DateTimeDigitized' 'exif:DateTimeOriginal'
  let ts;
  if(data.Properties['exif:DateTimeOriginal'] != undefined){
    console.warn('missing time zone information');
    ts = moment(data.Properties['exif:DateTimeOriginal'], 'YYYY:MM:DD HH:mm:ss').toDate().toISOString();
  }
  else if(data.Properties['exif:DateTime'] != undefined){
    console.warn('missing time zone information');
    ts = moment(data.Properties['exif:DateTime'], 'YYYY:MM:DD HH:mm:ss').toDate().toISOString();
  }
  else {
    ts = data.Properties['date:modify'];
  }

  let metadata = {'id':id, 'ts':ts, 'master_path':master_path};

  if(typeof text_analyzer !== 'undefined' ){
    const w = await text_analyzer.find_words(path_1024);
    metadata['words'] = w[0];
    metadata['word_locations'] = w[1];
  }

  return metadata;
}


console.log('Indexing objects in folder ' + MASTERS_PATH + ' ...');

glob(MASTERS_GLOB, {}, (er, files) =>
  files.forEach((f) => indexObj(f))
);



var app = express();

app.disable('x-powered-by');

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.static(DATA_PATH));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.locals.ANALYZE_TEXT = ANALYZE_TEXT;
  res.render('index');
});

app.get('/upload', (req, res) => res.render('upload'));

//TODO: prevent exceeding upload limits in ui
//TODO: remove unused streams after some time
app.post('/upload', (req, res) => {
  let user = auth(req);
  if (user == undefined){
    user = { name: 'anonymous', pass: undefined }
  }
  const target_dir = path.join(MASTERS_PATH, user.name) + '/';
  unchunk(req, res, target_dir, indexObj);
});

/**
 * Chronological paging either by first or by last timestamp of a sequence. If
 * applicable references for newer (next) and older (prev) objects are added.
 */
app.get('/api/timeline', async(req, res) => {

  if(typeof(req.query.lte) !== 'undefined' &&
      typeof(req.query.gte) !== 'undefined'){
    res.status(400);
    res.send("Don't use lte and gte together.");
    return;
  }

  const r = {seq:[]};

  if(typeof(req.query.lte) !== 'undefined'){
    const tmp = [];
    const stream = tsdb.createReadStream({gt:req.query.lte, limit:1});
    stream.on('data', (record) =>
      tmp.push({id:record.value.toString(), ts: record.key.toString()})
    );
    const end = new Promise(function(resolve, reject) {
        stream.on('end', () => resolve(tmp[0]));
        stream.on('error', reject);
    });
    r.next = await end;
  }

  else if(typeof(req.query.gte) !== 'undefined'){
    const tmp = [];
    const stream = tsdb.createReadStream(
      {reverse: true, lt:req.query.gte, limit:1});
    stream.on('data', (record) =>
      tmp.push({id:record.value.toString(), ts: record.key.toString()})
    );
    const end = new Promise(function(resolve, reject) {
        stream.on('end', () => resolve(tmp[0]));
        stream.on('error', reject);
    });
    r.prev = await end;
  }

  const stream_options = (typeof(req.query.gte) !== 'undefined')?
    {gte:req.query.gte, limit:MAX_GALLERY_SIZE + 1}
    : {reverse: true, lte:req.query.lte||undefined, limit:MAX_GALLERY_SIZE + 1};
  const stream = tsdb.createReadStream(stream_options);

  stream.on('data', (record) =>
    r.seq.push({id:record.value.toString(), ts: record.key.toString()})
  );
  stream.once('end', () => {
    if(typeof(req.query.gte) !== 'undefined'){
      if(r.seq.length > MAX_GALLERY_SIZE){
        r.next = r.seq[MAX_GALLERY_SIZE];
        r.seq.pop();
      }
      r.seq = r.seq.sort((a,b) => {return (a.ts < b.ts)?1:-1});
    }
    else if(r.seq.length > MAX_GALLERY_SIZE){
      r.prev = r.seq[MAX_GALLERY_SIZE];
      r.seq.pop();
    }
    res.json(r)
  });
});

// TODO: don't reveal absolute path of master file.
app.get('/api/metadata/:id', (req, res) =>
    objdb.get(req.params.id).then(x => res.json(x))
);

// TODO: Maybe add timestamp and other metadata
app.get('/api/search', (req, res) =>
  wdb.SEARCH('words:' + req.query.q).then(x => res.json(x.map(y => y.obj.id)))
);

// returns words with the given prefix
// TODO: Maybe limit the length of the returned array and/or accept only inputs
// above a minimal length.
// TODO: multi word autocompleteion.
// TODO: fuzzy matching.
app.get('/api/autocomplete', (req, res) =>
  wdb.DICTIONARY('words.' + req.query.q).then(x => res.json(x))
);


// Listen for file system changes of masters
// var watcher = chokidar.watch(MASTERS_GLOB, {
//   ignored: /(^|[\/\\])\../,
//   persistent: true
// });
// // Something to use when events are received.
// var log = console.log.bind(console);
// // Add event listeners.
// watcher
//   .on('add', path => {
//     log(`File ${path} has been added`);
//     indexObj(path);
//   })
//   .on('change', path => log(`File ${path} has been changed`))
//   .on('unlink', path => {
//     log(`File ${path} has been removed`);
//     log('ERROR: MASTER REMOVAL NOT IMPLEMENTED')
//   });



app.listen(process.env.PORT || 3000, () => {
  console.log('pxls app listening on port ' + (process.env.PORT || 3000));
});
