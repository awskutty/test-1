/**
 * Created by Msankar on 10/03/2016.
 * Description : To save the Eml Attachment 
 */
// Require dependencies
var reqExpress = require('express');
var path = require('path');
var fs = require('fs');
var fileExists = require('file-exists');
var reqDbInstance = require('../../../../torus-references/instance/CassandraInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter')
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo')
var reqResourceHelper = require('./helper/ResourceHelper.js');
var request = require('request');
var encryptor = require('file-encryptor');
var sha1 = require('sha1');
var crypto = require('crypto');

// Cassandra initialization
var mResClient = ''
//Queries
const imgselquery = "select text_data from trna_data where RELATIVE_PATH=? allow filtering"
const textquery = "select byte_data from trna_data where RELATIVE_PATH=? allow filtering"


// Initialize Global variables
var strResult = '';
var strMessage = '';
var router = reqExpress.Router();
router.post('/SaveEmlAttachment', function (pReq, pResp, pNext) {
    try {
        pHeaders = pReq.headers
        var params = pReq.body;
        PrepareEmlAttachment(pReq, param, function (rescallback) {
            pResp.send(rescallback)
        })
    } catch (ex) {
        reqLogWriter.TraceError(objLogInfo, ex, 'ERRXR001');


    }

})

module.exports = router;