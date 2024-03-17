/*
 *   @Author : Ragavendran
 *   @Description : To start a scheduler job
 *   @status : In Progress
 *   @created-Date : 19/10/2016
 */


var rootpath = "../../../../";
var modPath = rootpath + 'node_modules/';
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var schedule = require(modPath + 'node-schedule');
var reqCasInstance = require(rootpath + 'torus-references/instance/CassandraInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var constants = require('./util/message');
var util = require('./util/utility');
var cassandraCounter = require('./util/cassandraCounter');
var async = require(modPath + 'async');
var reqJobHelper = require('./helper/jobHelper');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqFXDBInstance = require(rootpath + 'torus-references/instance/DBInstance');


var ServiceName = 'startjob';

router.post('/startjob', function (req, res, next) {
    try {
        var resobj = {};
        var StartJobCommonReqObj = {};
        StartJobCommonReqObj.req = req;
        StartJobCommonReqObj.res = res;
        StartJobCommonReqObj.doRedisPubSub = true;
        reqJobHelper.StartJobCommon(StartJobCommonReqObj);

    }
    catch (error) {
        reqInstanceHelper.PrintError('SCHEDULER_CONSUMER', null, 'ERR-STARTJOB-0001', 'Catch Error in startjob API...', error);
        resobj.STATUS = 'FAILURE';
        resobj.DATA = [];
        res.send(resobj);
        reqLogWriter.EventUpdate(objLogInfo);
    }
});

module.exports = router;