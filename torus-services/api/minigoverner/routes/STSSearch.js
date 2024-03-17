/*  
Purpose         :Search system not assainged to application in wp
@Api_Name       : /STSSearch,
@Last_Error_code: ERR-MIN-ERR-MIN-52107'
  */


// Require dependencies
var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqStringBuilder = require(modPath + 'string-builder');
var reqLINQ = require(modPath + "node-linq").LINQ;

var x = '0';

var strServiceName = 'STSSearch'

router.post('/STSSearch', function(appRequest, appResponse) {

    var objLogInfo;
    reqLogInfo.AssignLogInfoDetail(appRequest, function(objLogInfo, sessionInfo) {
        try {
            reqInstanceHelper.PrintInfo(strServiceName, 'Begin', objLogInfo);
            objLogInfo.PROCESS = 'STSSearch-MiniGoverner';
            objLogInfo.ACTION_DESC = 'STSSearch';
            var mHeaders = appRequest.headers;
            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                var mClient = pCltClient;
                var strClientID = appRequest.body.PARAMS.CLIENT_ID;
                var strAppID = appRequest.body.PARAMS.APP_ID;
                var strClusterCode = appRequest.body.PARAMS.CLUSTER_CODE;
                var Searchsysname = appRequest.body.PARAMS.SEARCH_SYS_NAME;

                STSSearch(function(finalcallback) {
                    if (finalcallback.STATUS == 'SUCCESS') {
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, finalcallback.SUCCESS_DATA, objLogInfo, '', '', '', 'SUCCESS', finalcallback.INFO_MESSAGE);
                    } else {
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, finalcallback.ERROR_CODE, finalcallback.ERROR_MESSAGE, finalcallback.ERROR_OBJECT);
                    }
                });

                //STSSearch function 
                function STSSearch(finalcallback) {
                    try {
                        reqInstanceHelper.PrintInfo(strServiceName, 'STSSearch function executing..., system_to_system querying', objLogInfo);
                        //select query system_to_system
                        reqFXDBInstance.GetTableFromFXDB(mClient, 'system_to_system', [], {
                            'cluster_code': strClusterCode
                        }, objLogInfo, function callbacksearchuser(stsError, stsResult) {
                            try {
                                if (stsError) {
                                    finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-52101', 'GetTableFromFXDB system_to_system Failed ', stsError))
                                } else {
                                    reqInstanceHelper.PrintInfo(strServiceName, 'Got result from  system_to_system .Linq query executing...', objLogInfo);
                                    var arrsts = new reqLINQ(stsResult.rows)
                                        .Where(function(u) {
                                            return u.child_s_description.toUpperCase().startsWith(Searchsysname.toUpperCase())
                                        }).ToArray();
                                    var arrchildsid = new reqLINQ(arrsts)
                                        .Select(function(v) {
                                            return v.child_s_id;
                                        }).ToArray();
                                    // select from app_system_to_system table
                                    reqInstanceHelper.PrintInfo(strServiceName, 'Linq finished. Query app_system_to_system table  ', objLogInfo);
                                    reqFXDBInstance.GetTableFromFXDB(mClient, 'app_system_to_system', ['s_code', 's_description', 's_id', 'sts_id', 'wft_code', 'appsts_id', 'app_id', 'child_s_id'], {
                                        'app_id': strAppID,
                                        'cluster_code': strClusterCode
                                    }, objLogInfo, function(pError, appstsresult) {
                                        try {
                                            if (pError) {
                                                finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-52102', 'GetTableFromFXDB app_system_to_system  Failed ', pError))
                                            } else {
                                                reqInstanceHelper.PrintInfo(strServiceName, 'Got result  app_system_to_system , executing _searchsts function ', objLogInfo);
                                                _searchsts(appstsresult, arrsts, function(res) {
                                                    finalcallback(res)
                                                });
                                            }
                                        } catch (error) {
                                            finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-52103', 'Exception occured while executing select app_system_to_system table  ', error))
                                        }
                                    })
                                }
                            } catch (error) {
                                finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-52104', 'Exception occured while executing  callbacksearchuser  ', error))
                            }
                        });

                    } catch (error) {
                        finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-52105', 'Exception occured while executing  STSSearch ', error))
                    }
                }

                //Prepare private function 
                function _searchsts(pAppsts, arrsts, callback) {
                    try {
                        reqInstanceHelper.PrintInfo(strServiceName, 'Prepare Json result using stringbuilder ')
                        reqInstanceHelper.Prin
                        var sbSts = new reqStringBuilder();
                        sbSts.append("\{\"SYSTEM_TO_SYSTEM\" : [");
                        var x = 0;
                        for (var i = 0; i < arrsts.length; i++) {
                            var blnExist = false;
                            for (var j = 0; j < pAppsts.rows.length; j++) {
                                if (arrsts[i].child_s_id == pAppsts.rows[j].child_s_id) {
                                    blnExist = true;
                                    break;
                                }
                            }
                            if (!blnExist) {
                                if (x == 0) {
                                    sbSts.append("{");
                                }
                                if (x > 0) {
                                    sbSts.append(",{");
                                }
                                sbSts.appendFormat("\"STS_ID\"\:\"{0}\",\"S_DESCRIPTION\":\"{1}\",\"CLUSTER_CODE\":\"{2}\",\"\PARENT_S_ID\"\:\"\{3}\",\"CHILD_S_ID\":\"{4}\"}", arrsts[i].sts_id, arrsts[i].child_s_description, arrsts[i].cluster_code, arrsts[i].parent_s_id, arrsts[i].child_s_id);
                                x++;
                            }
                        }
                        sbSts.append("]}");
                        //prepare result to client
                        reqInstanceHelper.PrintInfo(strServiceName, '******STSSearch finished****** ', objLogInfo);
                        callback(sendMethodResponse("SUCCESS", '', sbSts, '', '', '', '', ''));
                    } catch (error) {
                        callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-52106', 'Exception occured while executing _searchsts ', error))
                    }
                }
            });
        } catch (error) {
            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-52107', 'Exception occured while executing AssignLogInfoDetail ', error, '', '');
        }
    })

    //Common Result  Preparation
    function sendMethodResponse(status, successMessage, SuccessDataObj, errorCode, errorMessage, errorObject, ProcessStatus, INfoMessage) {
        var obj = {
            'STATUS': status,
            'SUCCESS_MESSAGE': successMessage,
            'SUCCESS_DATA': SuccessDataObj,
            'ERROR_CODE': errorCode,
            'ERROR_MESSAGE': errorMessage,
            'ERROR_OBJECT': errorObject,
            'PROCESS_STATUS': ProcessStatus,
            'INFO_MESSAGE': INfoMessage,
        }
        return obj
    }
})
module.exports = router;
//*******End of Serive*******//