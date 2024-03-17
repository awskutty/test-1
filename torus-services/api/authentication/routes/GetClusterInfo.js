/*
@Api_Name : /GetClusterInfo,
@Description: To get the cluster system and system type information for logged in system
*/

// Require dependencies


var reqExpress = require('express');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqsvcHelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var router = reqExpress.Router();
var reqLINQ = require('node-linq').LINQ;
router.post('/GetClusterInfo', function callbackCpsignin(appRequest, appResponse) {
    try {
        var serviceName = 'GetClusterInfo';
        var pHeaders = appRequest.headers;
        var params = appRequest.body.PARAMS;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {

            DBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConnclt(pClientclt) {

                getsysInfo(params).catch(function (error) {
                    reqInstanceHelper.SendResponse(serviceName, appResponse, 'FAILURE', objLogInfo, 'ERR-AUT-001', 'Error occurec getsysInfo function ', error, 'FAILURE');
                });

                function _printInfo(message, objLogInfo) {
                    reqInstanceHelper.PrintInfo(serviceName, message, objLogInfo);
                }
                function getsysInfo(ParamsInfo) {
                    return new Promise((resolve, reject) => {
                        try {
                            _printInfo('getsysInfo function executing', objLogInfo);
                            var Condob = {};
                            Condob.cluster_code = ParamsInfo.ClusterCode;
                            Condob.app_id = ParamsInfo.Appid;

                            DBInstance.GetTableFromFXDB(pClientclt, 'APP_SYSTEM_TO_SYSTEM', ['s_id', 'parent_s_id', 's_code', 'st_code', 's_description', 'st_id'], Condob, objLogInfo, function (err, pRes) {
                                try {
                                    if (err) {
                                        _printInfo('Error occured get app sys to sys table ' + err, objLogInfo);
                                        reject(err);
                                    } else {
                                        getsystypeDesc(pRes.rows).then(function (result) {
                                            var totalLength = pRes.rows.length;
                                            var appstsRows = pRes.rows;
                                            for (var i = 0; i < totalLength; i++) {
                                                var sysTypeinfo = result.filter(row => row.st_id == appstsRows[i].st_id);
                                                if (sysTypeinfo.length) {
                                                    appstsRows[i]['st_desc'] = sysTypeinfo[0].st_description;
                                                }
                                            }

                                            var pReqObj = {};
                                            pReqObj.resultRows = appstsRows;
                                            pReqObj.curParentSID = params.SId;
                                            pReqObj.resultSId = [];
                                            _printInfo('Getting hierarchical parent lists', objLogInfo);
                                            // @ hparent - hierarchical parent list
            
                                            var hparent = reqsvcHelper.GetHierarchyParent(pReqObj);

                                            reqInstanceHelper.SendResponse(serviceName, appResponse, hparent, objLogInfo, '', '', '', 'SUCCESS');
                                        }).catch(function (error) {
                                            reqInstanceHelper.SendResponse(serviceName, appResponse, 'FAILURE', '', 'ERR-AUT-', 'Error occured getsystypeDesc function ', error, 'FAILURE');
                                        });
                                    }
                                } catch (error) {
                                    _printInfo('Exception occured ' + error, objLogInfo);
                                    reject(error);
                                }
                            });

                        } catch (error) {
                            _printInfo('Exception occured ' + error, objLogInfo);
                            reject(error);
                        }
                    });
                }

                function getsystypeDesc(rows) {
                    return new Promise((resolve, reject) => {
                        var SysIDs = new reqLINQ(rows)
                            .Select(function (data) { return data.st_id; })
                            .ToArray();

                        DBInstance.GetTableFromFXDB(pClientclt, 'SYSTEM_TYPES', ['st_description', 'st_id', 'st_code'], { st_id: SysIDs }, objLogInfo, function (pErr, pResult) {
                            if (pErr) {
                                reject(pErr);
                            } else {
                                resolve(pResult.rows);
                            }
                        });

                    });
                }
            });
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, 'FAILURE', '', 'ERR-AUT-', 'Exception occured ', error, 'FAILURE');
    }

});

module.exports = router;