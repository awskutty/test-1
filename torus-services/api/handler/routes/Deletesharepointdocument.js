var reqExpress = require('express');
var router = reqExpress.Router();
var reqDBInstance = require('../../../references/helper/CassandraInstance');
var reqCassandraInstance = require('../../../references/helper/CassandraInstance');
var reqLogInfo = require('../../../references/log/LogInfo');
var reqTranDBHelper = require('../../../references/helper/TranDBInstance');
var reqTranDBInstance = require('../../../references/helper/TranDBInstance');

var mTranDB = '';
router.post('/Deletesharepointdocument', function(pReq, pResp, next) {
    var Strrelativepath = pReq.body.RELATIVE_PATH;
    var strtype = pReq.body.TYPE;

    var objLogInfo = reqLogInfo.AssignLogInfoDetail(pReq.body, pReq);
    reqTranDBInstance.GetTranDBConn(pReq.headers, false, function(pSession) {
        mTranDB = pSession;
        var TRNA_ID = ""
        var status = ""
        var findtrn_idquery = "select trna_id  from trn_attachments where relative_path = '" + Strrelativepath + "' ";
        reqTranDBHelper.ExecuteSQLQuery(mTranDB, findtrn_idquery, objLogInfo, function(pattachResult, pErr) {
            if (pattachResult.rows.length == 0) {
                pResp.send("success");
            } else {
                for (var j = 0; j < pattachResult.rows.length; j++) {
                    TRNA_ID = pattachResult.rows[j].trna_id;
                }
            }


            if (strtype == 'NAVISION') {
                status = 'DELETED';
            }

            var updatetrnaid = "delete from trn_attachments  where trna_id = '" + TRNA_ID + "'";
            reqTranDBInstance.ExecuteSQLQuery(mTranDB, updatetrnaid, objLogInfo, function(pResult, pErr) {
                pResp.send('SUCCESS');
            });

        });


    });




});
module.exports = router;