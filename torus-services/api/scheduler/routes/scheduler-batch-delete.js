var rootpath = "../../../../";
var modPath = rootpath + 'node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqCasInstance = require(rootpath + 'torus-references/instance/CassandraInstance');
var reqLogWriter = require(rootpath + 'torus-references/log/trace/LogWriter')
var reqLogInfo = require(rootpath + 'torus-references/log/trace/LogInfo')
var constants = require('./util/message');
var async = require(modPath + 'async');
var uuid = require(modPath + 'uuid');
var reqDateFormatter = require(rootpath + 'torus-references/common/dateconverter/DateFormatter')


var reqFXDBInstance = require(rootpath + 'torus-references/instance/DBInstance')
var pHeaders = '';

//global variable
var pHeaders = "";
var mResCas = "";
var resobj = {};

router.post('/deletebatch', function (req, res, next) {
    try {
        pHeaders = req.headers;
        var mDevCas = '';
        req.body.SESSION_ID = "";
        var resdata = {};

        // var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
        reqLogInfo.AssignLogInfoDetail(req, function (objLogInfo, objSessionInfo) {
            objLogInfo.PROCESS = 'Deletebatch-Scheduler';
            objLogInfo.ACTION_DESC = 'Deletebatch';
            reqLogWriter.Eventinsert(objLogInfo);

            reqFXDBInstance.GetFXDBConnection(pHeaders, "dep_cas", objLogInfo, function (pCltClient) {
                mDevCas = pCltClient;

                var app_id = objLogInfo.APP_ID;
                var batch_id = req.body.batch_id;
                var client_id = req.body.client_id;

                if (batch_id == '') {
                    batch_id = uuid.v4();
                }

                var query = {
                    query: `delete from sch_batch where  batch_id = ?`,
                    params: [batch_id]
                }


                reqFXDBInstance.ExecuteSQLQueryWithParams(mDevCas, query, objLogInfo, function (pResult, pErr) {
                    if (pResult) {
                        resdata.STATUS = constants.SUCCESS;
                        resdata.MESSAGE = '';
                    }
                    else {
                        resdata.STATUS = constants.FAILURE;
                        resdata.MESSAGE = pErr.message;
                    }

                    res.send(resdata);
                });
            });
        })
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
