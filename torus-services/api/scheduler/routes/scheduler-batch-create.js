var rootpath = "../../../../";
var modPath = rootpath + 'node_modules/';
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLogWriter = require(rootpath + 'torus-references/log/trace/LogWriter');
var reqLogInfo = require(rootpath + 'torus-references/log/trace/LogInfo');
var constants = require('./util/message');
var uuid = require(modPath + 'uuid');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');


var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var pHeaders = '';

//global variable
var pHeaders = "";
var mResCas = "";
var resobj = {};

router.post('/createbatch', function (req, res, next) {
    try {
        pHeaders = req.headers;
        var mDevCas = '';
        req.body.SESSION_ID = "";
        var resdata = {};

        reqLogInfo.AssignLogInfoDetail(req, function (objLogInfo, objSessionInfo) {
            objLogInfo.PROCESS = 'CreateTemplate-Scheduler';
            objLogInfo.ACTION_DESC = 'CreateTemplate';
            reqLogWriter.Eventinsert(objLogInfo);

            reqFXDBInstance.GetFXDBConnection(pHeaders, "dep_cas", objLogInfo, function (pCltClient) {
                mDevCas = pCltClient;

                var app_id = objLogInfo.APP_ID;
                var batch_id = req.body.batch_id;
                var batch_name = req.body.batch_name;
                var client_id = req.body.client_id;

                if (batch_id == '') {
                    batch_id = uuid.v4();
                }

                // var query = "insert into sch_batch(batch_id,app_id,batch_name,batch_status,created_by,created_date) values(";
                // query += addSingleQuote(batch_id) + "," + addSingleQuote(app_id) + "," + addSingleQuote(batch_name) + "," + addSingleQuote("CREATED") + ",";
                // query += addSingleQuote(client_id) + "," + addSingleQuote(reqDateFormatter.GetCurrentDateInUTC(pHeaders, objLogInfo));
                // query += ")";

                // reqFXDBInstance.ExecuteQuery(mDevCas, query, objLogInfo, function (pErr, pResult) {
                var prow = [{
                    'batch_id': batch_id,
                    'app_id': app_id,
                    'batch_name': batch_name,
                    'batch_status': 'CREATED',
                    'created_by': objLogInfo.USER_ID,
                    'created_date': reqDateFormatter.GetCurrentDate(pHeaders, objLogInfo),
                    'tenant_id': objLogInfo.TENANT_ID
                }];
                reqFXDBInstance.InsertFXDB(mDevCas, 'SCH_BATCH', prow, objLogInfo, function (pErr, pResult) {
                    if (pErr) {
                        resdata.STATUS = constants.FAILURE;
                        resdata.MESSAGE = pErr.message;
                    }
                    else {
                        resdata.STATUS = constants.SUCCESS;
                        resdata.MESSAGE = '';
                    }

                    res.send(resdata);
                });
            });
        });
    }
    catch (ex) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = pErr.message;
        res.send(resdata);
    }
});


function addSingleQuote(data) {
    if (data !== null) {
        if (data.indexOf("'") > -1) {
            data = data.replaceAll("'", "''")
        }
        return "'" + data + "'";
    }
    else {
        return null;
    }
}

function dateString(date) {
    if (date !== null) {
        var myDate = new Date(date);
        hour = myDate.getHours();
        minute = myDate.getMinutes();
        second = myDate.getSeconds();
        return "'" + reqDateFormatter.ConvertDate("'" + myDate + "'", pHeaders, true) + "'";
    }
    else {
        return null;
    }
}

module.exports = router; 
