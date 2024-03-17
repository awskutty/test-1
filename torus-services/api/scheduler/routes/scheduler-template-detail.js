/*
 *   @Author : Ragavendran
 *   @Description : To list scheduler templates
 *   @status : Tested with sample data need to do with real data
 *   @created-Date : 18/10/2016
 *   @updated-at : 04/04/2017   
 */


var rootpath = "../../../../";
var modPath = rootpath + 'node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var schedule = require(modPath + 'node-schedule');
var reqCasInstance = require(rootpath + 'torus-references/instance/CassandraInstance');
var reqLogWriter = require(rootpath + 'torus-references/log/trace/LogWriter')
var reqLogInfo = require(rootpath + 'torus-references/log/trace/LogInfo')
var constants = require('./util/message');

var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');

var vsprintf = require(modPath + 'sprintf').vsprintf;


//global variable
var pHeaders = "";
var mResCas = "";
var resobj = {};

//Query
var QUERY_LIST_SCHEDULER_TEMPLATE = "select * from SCH_JOB_TEMPLATES where template_name = %s and app_id = %s";

router.post('/getTemplateDetail', function (req, res, next) {
    try {
        pHeaders = req.headers;

        var portal_type = "";
        var cas_type = "";
        var app_id = "";
        var template_name = "";

        //req.headers.routingkey = "";
        req.body.PARAMS = req.body;
        req.body.SESSION_ID = "";


        // var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
        reqLogInfo.AssignLogInfoDetail(req, function (objLogInfo, objSessionInfo) {
            objLogInfo.PROCESS = 'TemplateDetail-Scheduler';
            objLogInfo.ACTION_DESC = 'TemplateDetail';
            reqLogWriter.Eventinsert(objLogInfo);

            portal_type = req.body.portal_type;
            app_id = objLogInfo.APP_ID;
            template_name = req.body.template_name;

            if (portal_type === "CP") {
                cas_type = "dev_cas";
            } else {
                cas_type = "dep_cas";
            }

            // Get cassandra instance
            var mHeaders = req.headers;
            reqFXDBInstance.GetFXDBConnection(mHeaders, cas_type, objLogInfo, function (pCltClient) {
                mResCas = pCltClient;
                // call create scheduler template method
                getTemplateDetail(objLogInfo, template_name, app_id, function () {
                    res.send(resobj);
                })
            });
        })
    } catch (ex) {
        resobj.STATUS = constants.FAILURE;
        resobj.MESSAGE = ex;
        resobj.DATA = [];
        res.send(resobj);
    }
});

/**
 * List scheduler templates
 * 
 * @return - JSON response regarding success/failure and an array which contains the list of scheduler templates
 */
function getTemplateDetail(objLogInfo, template_name, app_id, callback) {
    try {
        var parsed_query = {
            query: `select * from SCH_JOB_TEMPLATES where template_name = ? and app_id = ?`,
            params: [template_name, app_id]
        }

        reqFXDBInstance.ExecuteSQLQueryWithParams(mResCas, parsed_query, objLogInfo, function (pResult, pErr) {
            if (pResult) {
                resobj.STATUS = constants.SUCCESS;
                resobj.DATA = pResult.rows;
                callback();
            } else {
                resobj.STATUS = constants.FAILURE;
                resobj.MESSAGE = pErr;
                resobj.DATA = [];
                callback();
            }
        });
    } catch (ex) {
        resobj.STATUS = constants.FAILURE;
        resobj.MESSAGE = ex;
        resobj.DATA = [];
        callback();
    }
}

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
        return "'" + myDate.getFullYear() + "-" + (myDate.getMonth() + 1) + "-" + myDate.getDate() + " " + hour + ":" + minute + ":" + second + "'";
    }
    else {
        return null;
    }
}

module.exports = router;