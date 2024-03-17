var rootpath = "../../../../";
var modPath = rootpath + 'node_modules/';
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqCasInstance = require(rootpath + 'torus-references/instance/CassandraInstance');
var reqLogWriter = require(rootpath + 'torus-references/log/trace/LogWriter');
var reqLogInfo = require(rootpath + 'torus-references/log/trace/LogInfo');
var constants = require('./util/message');
var async = require(modPath + 'async');
var uuid = require(modPath + 'uuid');
var reqDateFormatter = require(rootpath + 'torus-references/common/dateconverter/DateFormatter');


var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var pHeaders = '';

//global variable
var pHeaders = "";
var mResCas = "";
var resobj = {};

router.post('/listbatch', function (req, res, next) {
    try {
        pHeaders = req.headers;
        var mDevCas = '';
        req.body.SESSION_ID = "";
        var resdata = {};

        // var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
        reqLogInfo.AssignLogInfoDetail(req, function (objLogInfo, objSessionInfo) {
            objLogInfo.PROCESS = 'CreateTemplate-Scheduler';
            objLogInfo.ACTION_DESC = 'CreateTemplate';
            reqLogWriter.Eventinsert(objLogInfo);

            reqFXDBInstance.GetFXDBConnection(pHeaders, "dep_cas", objLogInfo, function (pCltClient) {
                mDevCas = pCltClient;

                var app_id = objLogInfo.APP_ID;

                // var query = "select * from sch_batch";

                // reqFXDBInstance.ExecuteQuery(mDevCas, query, objLogInfo, function (pErr, pResult) {
                var pcond = {
                    app_id: app_id,
                    tenant_id: objLogInfo.TENANT_ID
                };
                reqFXDBInstance.GetTableFromFXDB(mDevCas, 'SCH_BATCH', [], pcond, objLogInfo, function (pErr, pResult) {
                    if (pErr) {
                        resdata.STATUS = constants.FAILURE;
                        resdata.MESSAGE = pErr.message;
                        resdata.DATA = '';
                    }
                    else {
                        resdata.STATUS = constants.SUCCESS;
                        resdata.MESSAGE = '';
                        for (var i = 0; i < pResult.rows.length; i++) {
                            if (pResult.rows[i]['app_id'] !== app_id.toString()) {
                                pResult.rows.splice(i, 1);
                            }
                        }
                        resdata.DATA = pResult.rows;
                    }
                    res.send(resdata);
                });
            });
        });
    }
    catch (ex) {
        resdata.STATUS = constants.FAILURE;
        resdata.MESSAGE = pErr.message;
        resdata.DATA = '';
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
