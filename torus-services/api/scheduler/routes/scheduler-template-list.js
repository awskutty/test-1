/*
 *   @Author : Ragavendran
 *   @Description : To list scheduler templates
 *   @status : Tested with sample data need to do with real data
 *   @created-Date : 18/10/2016
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
var reqAsync = require('async');
var AQMHelper = require('./helper/AQMHelper');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

var vsprintf = require(modPath + 'sprintf').vsprintf;

//global variable
var pHeaders = "";
var mResCas = "";
var resobj = {};
var serviceName = 'LIST_TEMPLATE';
var portal_type = "";
var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
var isLatestPlatformVersion = false;
if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {
    reqInstanceHelper.PrintInfo(serviceName, 'Platform Version - ' + serviceModel.PLATFORM_VERSION, null);
    isLatestPlatformVersion = true;
}
//Query

router.post('/listtemplate', function (req, res, next) {
    try {
        var app_id = '';

        var QUERY_LIST_SCHEDULER_TEMPLATE = {
            query: "select * from SCH_JOB_TEMPLATES where app_id = ?",
            params: [app_id]
        }
        pHeaders = req.headers;

        //req.headers.routingkey = "";
        req.body.PARAMS = req.body;
        req.body.SESSION_ID = "";
        reqLogInfo.AssignLogInfoDetail(req, function (objLogInfo, objSessionInfo) {
            var tenant_id = objLogInfo.TENANT_ID;
            app_id = objLogInfo.APP_ID;
            if (isLatestPlatformVersion) {
                reqInstanceHelper.PrintInfo(serviceName, 'Adding TENANT ID Filters - ' + tenant_id, objLogInfo);
                var QRY_LIST_SCHEDULER_TEMPLATE = {
                    query: ` select * from SCH_JOB_TEMPLATES where app_id = ? + " and tenant_id = ?`,
                    params: [app_id, tenant_id]
                }
            }
            // QUERY_LIST_SCHEDULER_TEMPLATE = QUERY_LIST_SCHEDULER_TEMPLATE + '  allow filtering';
            reqInstanceHelper.PrintInfo(serviceName, 'Query After Adding TENANT ID Filter - ' + QRY_LIST_SCHEDULER_TEMPLATE, objLogInfo);
            // var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
            objLogInfo.PROCESS = 'TemplateList-Scheduler';
            objLogInfo.ACTION_DESC = 'TemplateList';
            reqLogWriter.Eventinsert(objLogInfo);

            portal_type = "";
            var cas_type = "";

            portal_type = req.body.portal_type;

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
                listSchedulerTemplates(objLogInfo, app_id, QRY_LIST_SCHEDULER_TEMPLATE, function () {

                    res.send(resobj);
                })
            });
        });
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
function listSchedulerTemplates(objLogInfo, app_id, QRY_LIST_SCHEDULER_TEMPLATE, callback) {
    try {
        var parsed_query = {
            query: ` select * from SCH_JOB_TEMPLATES where app_id = ? and tenant_id = ?`,
            params: [app_id, objLogInfo.TENANT_ID]
        }

        reqFXDBInstance.ExecuteSQLQueryWithParams(mResCas, parsed_query, objLogInfo, function (pResult, pErr) {
            if (pResult) {
                resobj.STATUS = constants.SUCCESS;
                if (portal_type == 'CP') { // Service call from CP to get AQM Locking
                    reqAsync.forEachSeries(pResult.rows, function (row, asyncallback) {
                        var condition = "app_id ='" + app_id + "' and category = 'scheduler_job_templates'  and code = '" + row.template_name + "' and designer_name = 'scheduler' ";
                        AQMHelper.AQMlocking(mResCas, condition, pHeaders, function (lockAQM) {
                            row.locked_by = lockAQM;
                            asyncallback();
                        })
                    }, function (pErr, pWarning) {
                        resobj.DATA = pResult.rows;
                        callback();
                    })
                } else { // Service call from WP 
                    resobj.DATA = pResult.rows;
                    callback();
                }
            }
            else {
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