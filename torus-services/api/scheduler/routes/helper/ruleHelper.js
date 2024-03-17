/*
 *   @Author : Ragavendran
 *   @Description : Helper file for job rule
 *   @status : In-Progress
 *   @created-Date : 03/10/2017
 *   @updated-at : 04/04/2017 
 */

var rootpath = "../../../../../";
var modPath = rootpath + 'node_modules/'
var reqFXDBInstance = require(rootpath + 'torus-references/instance/DBInstance')
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var jobHelper = require('./jobHelper.js')
var ServiceName = 'ruleHelper'


function getJobRule(mResCas, objLogInfo, job_name, callback) {

    var query = "select * from sch_jobs where job_name = '" + job_name + "' allow filtering";
    var obj = {};

    reqFXDBInstance.ExecuteQuery(mResCas, query, objLogInfo, function (pErr, pResult) {
        if (pErr) {
            var obj = {};
            obj.STATUS = "FAILURE";
            obj.MESSAGE = "Exception Occured";
            obj.DATA = "";
            obj.ERROR = pErr;
            CL("D", ServiceName, "Error getting job rule for job " + job_name + " due to " + pErr.message);
        } else {
            if (pResult.rows.length > 0) {
                var obj = {};
                obj.STATUS = "SUCCESS";
                obj.MESSAGE = "Has Rules";
                obj.DATA = pResult.rows[0]["rule_info"];
                obj.ERROR = {};
                CL("S", ServiceName, "Job rule obtained successfully for job " + job_name);
            } else {
                var obj = {};
                obj.STATUS = "FAILURE";
                obj.MESSAGE = "No Rule Found";
                obj.DATA = "";
                obj.ERROR = {};
                CL("S", ServiceName, "No rule found for job " + job_name);
            }
        }

        callback(obj);
    })
}

function createJobFromTemplate(mResCas, objLogInfo, template_name, MainJobRule, service_response, subjob, callback) {
    getTemplateDetails(mResCas, objLogInfo, template_name, function (template_response) {
        if (template_response.STATUS == "SUCCESS") {

            var sch_info = "";

            if (subjob.rule_info !== undefined) {
                var tempruleinfo = JSON.parse(subjob.rule_info);
                sch_info = tempruleinfo[0]["scheduler_info"];
            }
            else {
                sch_info = subjob["scheduler_info"];
            }

            //  var sch_info = subjob["scheduler_info"];

            template_response = template_response.DATA;
            var QUERY_INSERT_JOB = "insert into SCH_JOBS(APP_ID,ROUTING_KEY,JOB_NAME,JOB_DESCRIPTION,TEMPLATE_NAME,JOB_TYPE,CALLING_METHOD,JOB_MODE,OBJECT_NAME,PARAM_JSON,SCHEDULER_INFO,STATUS,CREATED_BY,CREATED_DATE,RULE_INFO) values(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)";
            var app_id = template_response.app_id || "";
            var routing_key = template_response.routing_key || "";
            var job_name = UUIDString();
            var job_description = "";
            var template_name = template_response.template_name;
            var job_type = template_response.job_type;
            var calling_method = template_response.calling_method;
            var job_mode = "RUNTIME";
            var object_name = template_response.object_name;
            var param_json = service_response;
            var scheduler_info = {}
            if (typeof (sch_info) === "string") {
                sch_info = JSON.parse(sch_info)
            }

            var user_id = "";

            var createdDate = reqDateFormatter.GetCurrentDateInUTC(objLogInfo.headers, objLogInfo);
            jobHelper.CreateJobNew(mResCas, QUERY_INSERT_JOB, objLogInfo, app_id, routing_key, job_name, job_description, template_name, job_type, calling_method, job_mode, object_name, JSON.stringify(param_json), JSON.stringify(sch_info), "CREATED", user_id, createdDate, MainJobRule, function (resJobCreate) {
                callback(job_name, app_id, resJobCreate);
            });
        } else {
            callback("", "")
        }
    })
}




function updateJobSchDetails(mResCas, objLogInfo, job_name, service_response, job_count, callback) {
    var query = "update SCH_JOBS set param_json = '" + JSON.stringify(service_response) + "',retry_attempt = '" + job_count + "' where job_name = '" + job_name + "'";
    reqFXDBInstance.ExecuteQuery(mResCas, query, objLogInfo, function (pErr, pResult) {
        callback("")
    });
}

function getTemplateDetails(mResCas, objLogInfo, template_name, callback) {
    var query = "select * from sch_job_templates where template_name = '" + template_name + "' allow filtering"

    reqFXDBInstance.ExecuteQuery(mResCas, query, objLogInfo, function (pErr, pResult) {
        if (pErr) {
            var obj = {};
            obj.STATUS = "FAILURE";
            obj.MESSAGE = "Exception Occured";
            obj.DATA = {};
            obj.ERROR = pErr;
            CL("D", ServiceName, "Error getting template details for template " + template_name + " due to " + pErr.message);
        } else {
            if (pResult.rows.length > 0) {
                var obj = {};
                obj.STATUS = "SUCCESS";
                obj.MESSAGE = "Got Template Detail";
                obj.DATA = pResult.rows[0];
                obj.ERROR = {};
            } else {
                var obj = {};
                obj.STATUS = "FAILURE";
                obj.MESSAGE = "No  Template Detail Found";
                obj.DATA = {};
                obj.ERROR = {};
            }
            CL("S", ServiceName, "Template details obtained successfully for template " + template_name);
        }

        callback(obj);
    })
}


module.exports = {
    GetJobRule: getJobRule,
    CreateJobFromTemplate: createJobFromTemplate,
    UpdateJobSchDetails: updateJobSchDetails
}