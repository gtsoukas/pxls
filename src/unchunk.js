// messy handling of chunked file uploads e.g. in conjunction with express

'use strict';

const Busboy = require('busboy');
const crypto = require('crypto');
const fs = require('fs');


//TODO: remove unused streams after some time
const streams = {};

module.exports = (options) => {
  return (req, res, target_dir, callback) => {

    var busboy = new Busboy({ headers: req.headers });

    req.pipe(busboy);
    busboy.on('file', (fieldname, file, filename) => {
      //console.log('Uploading: ' + filename);

      const target_file = target_dir + filename;
      if (!fs.existsSync(target_dir)){
        fs.mkdirSync(target_dir);
      }

      if(req.headers['content-range']) {

        const match = req.headers['content-range'].match(/(\d+)-(\d+)\/(\d+)/);
        if(!match || !match[1] || !match[2] || !match[3]) {

            res.status(400).send('Bad Request');
            return;
        }

        const start = parseInt(match[1]);
        const end = parseInt(match[2]);
        const total = parseInt(match[3]);
        //console.log(start, end, total);

        const hash = crypto.createHash('sha1').update(filename + total).digest('hex');
        const tmp_target_file = target_file + '.part';

        let stream = streams[hash];
        if(!stream) {

          stream = fs.createWriteStream(tmp_target_file, {flags: 'a+'});
          streams[hash] = stream;
          //console.log("new stream created");
        }

        var size = 0;
        if(fs.existsSync(tmp_target_file)) {
          size = fs.statSync(tmp_target_file).size;
        }

        // basic sanity checks for content range
        if((end + 1) == size) {
          console.log("duplicate chunk");
          //res.status(201).send('Created');
          res.status(201).json({"files": [
            {
              "name": filename
            }]});
           return;
        }

        if(start != size) {

            //res.status(400).send('Bad Request');
            res.status(400).json({"files": [
            {
              "name": filename,
              "size": size,
              "error": "File exists"
            }]});
            return;
        }

        // last chunk
        if(end + 1 == total) {
          //console.log("writing last chunk");
          file.pipe(stream, { end: true });
          // all chunks have been received
          stream.on('finish', () => {
            res.status(201).json({"files": [
                {
                  "name": filename
                }]});
            //console.log("stream finished");
            delete streams[hash];
            fs.renameSync(tmp_target_file, target_file);
            //indexObj(target_file);
            // indexObj('data/masters/' + user.name + '/' + filename);
            callback(target_file);
          });

        }
        // any other chunk
        else{
          //console.log("writing chunk");
          file.pipe(stream, { end: false });

          file.on('end', () => {
            res.status(201).json({"files": [
                {
                  "name": filename
                }]});

          });

          file.on('error', (err) => {
            console.error('Error while receiving file upload');
            res.status('500').send('Internal Server Error');
          });


        }

        // TODO...
        /*if(start + file.length >= total) {

          // all chunks have been received
          //stream.on('finish', function() {
          //  console.log("stream finished!");
            //process_upload(target_file);
          //});

          //stream.end();
          res.status(201).json({"files": [
          {
            "name": filename
          }]});
        }
        else {*/
          // this chunk has been processed successfully
          //res.status(201).send("Created");

       // res.status(201).json({"files": [
       // {
       //   "name": filename
       // }]});

        //}


      }
      else {
        console.log('Unchunked upload');

        let fstream = fs.createWriteStream(target_file);
        file.pipe(fstream);
        fstream.on('close', () => {
            // indexObj(target_file);
            callback(target_file);
            res.status(201).json({"files": [
            {
              "name": filename
            }]});
        });

      }

    });
  }
}
