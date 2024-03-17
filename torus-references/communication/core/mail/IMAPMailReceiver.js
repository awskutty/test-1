/*
  @Decsription: Helper file for receiving mails using IMAP  
*/

// Require dependencies
var inspect = require('util').inspect;
var fs = require('fs');
var base64 = require('base64-stream');
// var Imap = require('imap');
var reqInstanceHelper = require('../../../common/InstanceHelper');
var serviceName = 'IMAPMailReceiver';
var connectedMailServers = {};
var objLogInfo = null;
var Imap = {} // imap npm removed for vulnerability issue. need to do alternative
// Add the received mails to array
function ReceiveMailData(options, callback) {
    var imap = new Imap(options);
    var allUnReadMails = [];

    function toUpper(thing) {
        return thing && thing.toUpperCase ? thing.toUpperCase() : thing;
    }

    function findAttachmentParts(struct, attachments) {
        attachments = attachments || [];
        for (var i = 0, len = struct.length, r; i < len; ++i) {
            if (Array.isArray(struct[i])) {
                findAttachmentParts(struct[i], attachments);
            } else {
                if (struct[i].disposition && ['INLINE', 'ATTACHMENT'].indexOf(toUpper(struct[i].disposition.type)) > -1) {
                    attachments.push(struct[i]);
                }
            }
        }
        return attachments;
    }

    function buildAttMessageFunction(attachment, callback) {
        var filename = attachment.params.name;
        var encoding = attachment.encoding;

        return function (msg, seqno) {
            var prefix = '(#' + seqno + ') ';
            msg.on('body', function (stream, info) {
                //Create a write stream so that we can stream the attachment to file;
                //console.log(prefix + 'Streaming this attachment to file', filename, info);
                var writeStream = fs.createWriteStream(filename);
                writeStream.on('finish', function () {
                    //console.log(prefix + 'Done writing to file %s', filename);
                    fs.readFile(filename, 'base64', function (err, data) {
                        if (err) {
                            console.log(err.stack);
                        } else {
                            //console.log(data);
                            callback(filename, data);
                            fs.unlink(filename, function (err) {
                                if (err) {
                                    console.log(err.stack);
                                } else {
                                    //console.log('successfully deleted ', filename);
                                }
                            });
                        }
                    });
                });

                //stream.pipe(writeStream); this would write base64 data to the file.
                //so we decode during streaming using 
                if (toUpper(encoding) === 'BASE64') {
                    //the stream is base64 encoded, so here the stream is decode on the fly and piped to the write stream (file)
                    stream.pipe(base64.decode()).pipe(writeStream);
                } else {
                    //here we have none or some other decoding streamed directly to the file which renders it useless probably
                    stream.pipe(writeStream);
                }
            });
            msg.once('end', function () {
                console.log(prefix + 'Finished attachment %s', filename);
            });
        };
    }

    function openInbox(cb) {
        imap.openBox('INBOX', false, cb);
    }
    imap.once('ready', function () {
        openInbox(function (err, box) {
            if (err) {
                console.log(err.stack);
            } else {
                connectedMailServers[imap._config.user] = imap;
                console.log('imap connection ready.');
            }
        });
    });
    imap.once('error', function (error) {
        console.log(error.stack);
        imap.end();
        return callback(null);
    });
    imap.on('mail', function (count) {
        if (count) {
            imap.search(['UNSEEN'], function (err, results) {
                if (err) {
                    console.log(err.stack);
                } else {
                    if (results.length) {
                        var currMsgCount = 0;
                        var f = imap.fetch(results, {
                            bodies: ['HEADER', 'TEXT'],
                            struct: true,
                            markSeen: true
                        });
                        f.on('message', function (msg, seqno) {
                            var mailHeader = {};
                            var mailAttributes = {};
                            var mailBody = {};
                            var mailAttachments = [];
                            //console.log('Message #%d', seqno);
                            var prefix = '(#' + seqno + ') ';
                            msg.on('body', function (stream, info) {
                                if (info.which === 'TEXT') {
                                    //console.log(prefix + 'Body [%s] found, %d total bytes', inspect(info.which), info.size);
                                }
                                var buffer = '', count = 0;
                                stream.on('data', function (chunk) {
                                    count += chunk.length;
                                    //buffer += chunk.toString('utf8');
                                    if (info.which === 'TEXT') {
                                        //console.log(prefix + 'Body [%s] (%d/%d)', inspect(info.which), count, info.size);
                                        buffer += chunk.toString('base64');
                                        //stream.pipe(fs.createWriteStream('msg-' + seqno + '-body.pdf'));
                                    } else {
                                        buffer += chunk.toString('utf8');
                                    }
                                });
                                stream.once('end', function () {
                                    if (info.which === 'HEADER') {
                                        //console.log(prefix + 'Parsed header: %s', inspect(Imap.parseHeader(buffer)));
                                        mailHeader = Imap.parseHeader(buffer);
                                    } else if (info.which === 'TEXT') {
                                        //console.log(prefix + 'TEXT [%s] Finished : ', buffer.toString());
                                        mailBody = new Buffer.from(buffer, 'base64').toString();
                                    }
                                    //mailHeader = Imap.parseHeader(buffer);
                                });
                            });

                            msg.once('attributes', function (attrs) {
                                var attachments = findAttachmentParts(attrs.struct);
                                //console.log(prefix + 'Has attachments: %d', attachments.length);
                                var i = 0;
                                readAttachment(attachments[i]);
                                function readAttachment(attachment) {
                                    if (attachment) {
                                        i++;
                                        //var attachment = attachments[i];
                                        //console.log(prefix + 'Fetching attachment %s', attachment.params.name);
                                        var atmtFetch = imap.fetch(attrs.uid, { //do not use imap.seq.fetch here
                                            bodies: [attachment.partID],
                                            struct: true
                                        });
                                        //build function to process attachment message
                                        atmtFetch.on('message', buildAttMessageFunction(attachment, function (name, byteData) {
                                            var atmt = {};
                                            atmt.Name = name;
                                            atmt.ByteContent = byteData;
                                            mailAttachments.push(atmt);
                                            if (i < attachments.length) {
                                                readAttachment(attachments[i]);
                                            } else {
                                                messageFinished();
                                            }
                                        }));
                                    } else {
                                        messageFinished();
                                    }
                                }
                            });
                            function messageFinished() {
                                currMsgCount++;
                                console.log(prefix + 'Finished');
                                var mailDetails = {
                                    Subject: mailHeader['subject'],
                                    From: mailHeader['from'],
                                    To: mailHeader['to'],
                                    Date: mailHeader['date'],
                                    Cc: mailHeader['cc'],
                                    Bcc: mailHeader['bcc'],
                                    Body: mailBody,
                                    Attachments: mailAttachments
                                };
                                allUnReadMails.push(mailDetails);
                                if (currMsgCount == results.length) {
                                    console.log('Done fetching all messages!');
                                    //imap.end();
                                    return callback(allUnReadMails);
                                }
                            }
                        });
                        f.once('error', function (err) {
                            console.log('Fetch error: ' + err.stack);
                        });
                    } else {
                        console.log('you are already up to date');
                        //imap.end();
                        return callback(null);
                    }
                }
            });
        }
    });
    if (!connectedMailServers[options.user]) {
        imap.connect();
    } else {
        reqInstanceHelper.PrintInfo(serviceName, options.user + '-already connected.', objLogInfo);
        return callback(null);
    }
}

function disconnect(callback) {
    var connectedMailIds = Object.keys(connectedMailServers);
    for (var i = 0; i < connectedMailIds.length; i++) {
        var currMailId = connectedMailIds[i];
        var currImap = connectedMailServers[currMailId];
        currImap.end();
        reqInstanceHelper.PrintInfo(serviceName, currMailId + '.....Disconnected.', objLogInfo);
    }
    return callback(null);
}

module.exports = {
    ReceiveMailData: ReceiveMailData,
    Disconnect: disconnect
}
/********* End of File *************/