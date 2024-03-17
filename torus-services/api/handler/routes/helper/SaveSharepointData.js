var reqExpress = require('express');
var reqBase64 = require('base64-js');
var reqDbInstance = require('../../../../../torus-references/instance/CassandraInstance');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter')
var reqLogInfo = require('../../../../../torus-references/log/trace/LogInfo')
var path = require('path')
var fs = require('fs');


// Cassandra initialization
var mResClient;

//Queries
const tranqueryimg = "insert into trna_data(TRNAD_ID,RELATIVE_PATH,TEXT_DATA) VALUES(UUID(),?,?)"
const tranquery = "insert into trna_data(TRNAD_ID,RELATIVE_PATH,BYTE_DATA) VALUES(UUID(),?,?)"


// Initialize Global variables
var strResult = '';
var strMessage = '';
var router = reqExpress.Router();



function savesharepointdata(arrAtmts, req, pCallback) {


    reqDbInstance.GetCassandraConn(req.headers, 'res_cas', function Callback_GetCassandraConn(pClient) {
        mResClient = pClient;

        arrAtmts.forEach(function(atmt) {
            RelativePath = atmt.RELATIVE_PATH
            var Atcode = atmt.AT_CODE
            FILE_NAME = atmt.FILE_NAME
            extension = path.extname(atmt.FILE_NAME);
            literName = path.basename(atmt.FILE_NAME, extension);
            var bytedata = atmt.BYTE_DATA;

            if (Atcode != "" && Atcode.toUpperCase() == "IMG") {
                var TextData = new Buffer.from(bytedata).toString('base64');
                mResClient.execute(tranqueryimg, [RelativePath.toUpperCase().trim(), bytedata], {
                    prepare: true
                }, function callbackcltsetup(err, result) {
                    if (err) {
                        console.log('execute failed' + err.toString());

                    } else {
                        console.log('tran insert success');
                    }
                })

            } else {

                var TextData = new Buffer.from(bytedata, 'base64')
                    //   var TextData = new Buffer.from(bytedata);
                    //  var pdata = new Buffer.from(bytedata).toString('base64');
                    // var pdata = Buffer.from(bytedata, 'base64');
                    //  var buf = new Buffer.from(bytedata, 'base64');
                    // var txtvalue = bytedata.toString('base64');
                var byt = new Buffer.from(TextData, 'utf8')
                    // fs.writeFile("D:\\test.doc", byt);

                mResClient.execute(tranquery, [RelativePath.toUpperCase().trim(), byt], {
                    prepare: true
                }, function trandatainsert(err, result) {
                    if (err) {
                        console.log('execute failed');
                    } else {
                        console.log('tran insert success');
                    }

                })
            }
        });
    });
    strResult = "SUCCESS"
    successcallback();


    function successcallback() {

        pCallback(strResult);
    }

}



function SaveAttachmentDetails() {
    this.RELATIVE_PATH = ""
    this.FILE_NAME = ""
    this.FILE_SIZE = ""
    this.RS_PATH = ""
    this.RS_CODE = ""
    this.TRN_ID = 0
    this.DTT_CODE = ""
    this.ATMT_DTT_CODE = ""
    this.DTTA_ID = 0
    this.DTTAD_ID = 0
    this.DTTADIF_ID = 0
    this.AT_CODE = ""
    this.BYTE_DATA = ""

}
module.exports = {
    savesharepointdata: savesharepointdata
};