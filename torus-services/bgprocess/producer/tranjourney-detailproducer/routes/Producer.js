/****
  @Descriptions     :  To read redis keys for tran db, and create child processes for each tran db 
                       To produce transaction_journey_detail values to kafka 
  @Last_Error_Code  :  ERR_TRAN_JOURNEY_DATA_PRODUCER_0001
 ****/

// Require dependencies
var reqAsync = require('async');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
var reqThreadHelper = require('./ThreadHelper');

// Global variable initialization
var serviceName = 'TRANJourneyDetailProducer';
var logFilePath = 'bgprocess/producer/tranjourney-detailproducer';
var objLogInfo = GetObjLogInfo();

// Read redis keys, filter TRANDB key values and create child process for each
function produceWithAllTranDBKeys(produceWithAllTranDBKeysParam, callback) {
    try {
        reqInstanceHelper.PrintInfo(serviceName, 'Transaction journey detail Producer process starting...', objLogInfo);
        var GetAllUniqueTranDBKeysObj = { objLogInfo };
        reqInstanceHelper.GetAllUniqueTranDBKeys(GetAllUniqueTranDBKeysObj, function (error, arrUniqueTranDBKeys, isTenantMultiThreaded) {
            if (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_TRAN_JOURNEY_DATA_PRODUCER_0001', 'Error in GetAllUniqueTranDBKeys()...', error);
            } else if (!arrUniqueTranDBKeys.length) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_TRAN_JOURNEY_DATA_PRODUCER_0002', 'There is No TRANDB keys, so Workers will not be Created...', '');
            } else {
                reqAsync.forEachOfSeries(arrUniqueTranDBKeys, function (eachTranDBKey, i, nextTranDBKey) {
                    var headers = {
                        routingkey: eachTranDBKey.toUpperCase(),
                        IS_TENANT_MULTI_THREADED: isTenantMultiThreaded,
                        LOG_INFO: JSON.stringify(GetObjLogInfo())
                    };
                    var jsonToSend = {
                        headers: headers,
                        SERVICE_NAME: produceWithAllTranDBKeysParam.SERVICE_NAME
                    }
                    reqThreadHelper.InitiateThread(jsonToSend, function (msgFromWorker) {
                        reqInstanceHelper.PrintInfo(serviceName, msgFromWorker, objLogInfo);
                        nextTranDBKey();
                    });
                }, function () {
                    reqInstanceHelper.PrintInfo(serviceName, 'All the Workers are initiated for TranDB Routing Keys', objLogInfo);
                    callback();
                });
            }
        });

    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_TRAN_JOURNEY_DATA_PRODUCER_0003', 'Catch Error in produceWithAllTranDBKeys()...', error);
        callback();
    }
}

function GetObjLogInfo() {
    try {
        return reqLogWriter.GetLogInfo('TRANJourneyDetailProducer_PRODUCER', 'TRANJourneyDetailProducer_PRODUCER_PROCESS', 'TRANJourneyDetailProducer_PRODUCER_ACTION', logFilePath);
    } catch (error) {
        return {};
    }
}

module.exports = {
    ProduceWithAllTranDBKeys: produceWithAllTranDBKeys
};
/******** End of File **********/