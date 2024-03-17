/*
 *   @Author : Ragavendran
 *   @Description : To edit a scheduler template
 *   @status : Tested with sample data need to do with real data
 *   @created-Date : 19/10/2016
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

//global variable
var pHeaders = "";
var mResCas = "";
var resobj = {};

//Query
var QUERY_EDIT_SCHEDULER_TEMPLATE = "update SCH_JOB_TEMPLATES set APP_ID = ? , ROUTING_KEY = ?, JOB_TYPE = ?, CALLING_METHOD = ?, OBJECT_NAME = ?, PARAM_JSON = ?, MODIFIED_BY = ?, MODIFIED_DATE = ? where TEMPLATE_NAME = ? and app_id = ?";

router.post('/edittemplate', function (req, res, next) {
    try {
        pHeaders = req.headers;

        // variable initialization
        var workSpace = req.body.workSpace;
        var TEMPLATE_DETAILS = workSpace.TEMPLATE_DETAILS;
        var TEMPLATE_NAME = workSpace.TEMPLATE_NAME;

        var TEMPLATE_DESCRIPTION = workSpace.TEMPLATE_DESCRIPTION;
        var TYPE = workSpace.TYPE;
        var TEMPLATE = workSpace.TEMPLATE;

        var FREQUENCY_TYPE = TEMPLATE_DETAILS.FREQUENCY_TYPE
        var FREQUENCY = TEMPLATE_DETAILS.FREQUENCY;
        var START_ACTIVE_DATE = TEMPLATE_DETAILS.START_ACTIVE_DATE;
        var END_ACTIVE_DATE = TEMPLATE_DETAILS.END_ACTIVE_DATE;

        var OBJECT_NAME = workSpace.OBJECT_NAME;
        var RUN_TYPE = workSpace.RUN_TYPE;
        var PARAMS = workSpace.PARAMS;
        var JOBS = workSpace.JOBS;
        var IS_LOCKED = workSpace.IS_LOCKED;
        var LOCKED_BY = workSpace.LOCKED_BY;
        var IS_NEW = workSpace.IS_NEW;

        var APP_ID = req.body.APP_ID;
        var U_ID = req.body.U_ID;
        var USER_LANG_CODE = req.body.USER_LANG_CODE;
        var USER_LANGUAGES = req.body.USER_LANGUAGES;
        var USER_ID = req.body.USER_ID;
        var USER_NAME = req.body.USER_NAME;
        var LOGIN_NAME = req.body.LOGIN_NAME;
        var LOGIN_IP = req.body.LOGIN_IP;
        var CLIENT_ID = req.body.CLIENT_ID;
        var SESSION_ID = req.body.SESSION_ID;
        var APP_CODE = req.body.APP_CODE;
        var APP_TYPE = req.body.APP_TYPE;
        var APP_REQ_ID = req.body.APP_REQ_ID;
        var REQ_DESC = req.body.REQ_DESC;

        // To be added in client
        var CAS_TYPE = req.body.CAS_TYPE;
        var ROUTING_KEY = req.body.ROUTING_KEY;
        var JOB_TYPE = workSpace.JOB_TYPE; // present TYPE
        var CALLING_METHOD = workSpace.CALLING_METHOD;
        var PARAM_JSON = workSpace.PARAM_JSON; // current PARAMS

        // Get cassandra instance
        reqCasInstance.GetCassandraConn(pHeaders, CAS_TYPE, function (pClient) {
            mResCas = pClient;
            // call create scheduler template method
            editSchedulerTemplate(APP_ID, ROUTING_KEY, JOB_TYPE, CALLING_METHOD, OBJECT_NAME, JSON.stringify(PARAM_JSON), U_ID.toString(), new Date(), TEMPLATE_NAME, function () {
                res.send(resobj);
            })
        });
    } catch (ex) {
        resobj.STATUS = constants.FAILURE;
        resobj.MESSAGE = ex;
        res.send(resobj);
    }
});

/**
 * edit a scheduler template
 * 
 * @param object_name - API Url for which the execution to be done
 * @param calling_method - Defines the method type (GET/POST)
 * @param param_json - Contains the api request body 
 * @param job_type - Defines the type of job whether it as API/DB scripts
 * @param template_code - Unique ID for scheduler template
 * 
 * @return - JSON response regarding success/failure of edit
 */
function editSchedulerTemplate(APP_ID, ROUTING_KEY, JOB_TYPE, CALLING_METHOD, OBJECT_NAME, PARAM_JSON, MODIFIED_BY, MODIFIED_DATE, TEMPLATE_NAME, callback) {
    try {
        mResCas.execute(QUERY_EDIT_SCHEDULER_TEMPLATE, [APP_ID, ROUTING_KEY, JOB_TYPE, CALLING_METHOD, OBJECT_NAME, PARAM_JSON, MODIFIED_BY, MODIFIED_DATE, TEMPLATE_NAME], {
            prepare: true
        }, function (pErr, pResult) {
            if (pErr) {
                resobj.STATUS = constants.FAILURE;
                resobj.MESSAGE = pErr.message;
                callback();
            } else {
                resobj.STATUS = constants.SUCCESS;
                resobj.MESSAGE = constants.SCHEDULER_TEMPLATE_UPDATION_SUCCESS;
                callback();
            }
        });
    } catch (ex) {
        resobj.STATUS = constants.FAILURE;
        resobj.MESSAGE = ex;
        callback();
    }
}

module.exports = router;