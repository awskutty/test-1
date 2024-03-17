var reqExpress = require('express');
var router = reqExpress.Router();
var StringBuilder = require("string-builder");
var fs = require('fs');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');


var objLogInfo = '';
router.post('/LoadSharepointdocument', function(req, res, next) {
    //reqCassandraInstance.GetCassandraConn(req.headers, 'res_cas', function Callback_GetCassandraConn(mClient) {
    reqDBInstance.GetFXDBConnection(req.headers, 'res_cas', objLogInfo, function Callback_GetCassandraConn(mClient) {
        var strOrm = 'knex';
        var RelativePath = req.body.KEYDATA;
        var pAt_code = req.body.AT_CODE;
        var byt;
        var strqyery = '';
        if (pAt_code == 'IMG') {
            strqyery = ['text_data']
        } else {
            strqyery = ['byte_data']
        }
        // mClient.execute(strqyery, [RelativePath], {
        //     prepare: true
        // }, function(err, pResult) {



        var conddt = new Object();
        conddt.Relative_Path = RelativePath;
        reqDBInstance.GetTableFromFXDB(mClient, 'TRNA_DATA', strqyery, conddt, objLogInfo, function(pError, pResult) {


            if (pError)
                console.log(pError);
            else {
                if (pResult.rows.length == 0) {
                    console.log('key_column not found", "ERR-FX-133401');
                } else {
                    if (pAt_code == 'IMG') {
                        byt = pResult.rows[0].text_data;
                        //   byt = Convert.ToBase64String(byt)
                        res.send(byt);
                    } else {

                        byt = pResult.rows[0].byte_data;
                        res.set('Content-Type', 'application/octet-stream');
                        res.set('Content-Length', Buffer.byteLength(byt));
                        res.send(byt);


                    }
                }

            }

        });
    });
});
module.exports = router;