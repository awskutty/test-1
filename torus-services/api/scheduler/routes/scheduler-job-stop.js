/*
 *   @Author : Ragavendran
 *   @Description : To stop a scheduler job
 *   @status : In-Progress
 *   @created-Date : 20/10/2016
 *   @Error_CODE : 'ERR-STOPJOB-0001'
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
var util = require('./util/utility');
var cassandraCounter = require('./util/cassandraCounter');
var async = require(modPath + 'async');
var reqJobHelper = require('./helper/jobHelper');
var schedulerUtil = require('./util/schedulerUtil');

//global variable
var pHeaders = "";
var mDevCas = "";
var resobj = {};

var reqFXDBInstance = require(rootpath + 'torus-references/instance/DBInstance');
var ServiceName = 'STOPJOB';
global.jobs = [];

router.post('/stopjob', function (req, res, next) {


    try {
        var resobj = {};
        var StopJobCommonReqObj = {};
        StopJobCommonReqObj.req = req;
        StopJobCommonReqObj.res = res;
        StopJobCommonReqObj.doDBOperations = true;
        StopJobCommonReqObj.doRedisPubSub = true;
        reqJobHelper.StopJobCommon(StopJobCommonReqObj);

    }
    catch (error) {
        reqInstanceHelper.PrintError(ServiceName, null, 'ERR-STOPJOB-0001', 'Catch Error in stopjob API...', error);
        resobj.STATUS = 'FAILURE'; //Success for stop job
        resobj.DATA = [];
        res.send(resobj);
    }
});



module.exports = router;