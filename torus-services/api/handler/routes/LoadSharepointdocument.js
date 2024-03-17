var reqExpress = require('express');
var router = reqExpress.Router();
var reqCassandraInstance = require('../../../references/helper/CassandraInstance');
var StringBuilder = require("string-builder");
var fs = require('fs');



router.post('/LoadSharepointdocument', function(req, res, next) {
    var objLogInfo = '';
    reqCassandraInstance.GetCassandraConn(req.headers, 'res_cas', function Callback_GetCassandraConn(mClient) {
        var strOrm = 'knex';
        var RelativePath = req.body.KEYDATA;
        var pAt_code = req.body.AT_CODE;
        var byt;
        var strqyery = '';
        if (pAt_code == 'IMG') {
            strqyery = 'select text_data from trna_data  where Relative_Path =? allow filtering ;'
        } else {
            strqyery = 'select byte_data from trna_data where Relative_Path =? allow filtering ;'
        }
        mClient.execute(strqyery, [RelativePath], {
            prepare: true
        }, function(err, pResult) {
            if (err) {
                console.log(err);
                res.send("");
            } else {
                if (pResult.rows.length == 0) {
                    console.log('key_column not found", "ERR-FX-133401');
                    res.send("");
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