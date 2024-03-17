/*
@Api_Name : /GetClusterDetails,
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
router.post('/GetClusterDetails', function callbackCpsignin(appRequest, appResponse) {
    try {
        var serviceName = 'GetClusterDetails';
        var pHeaders = appRequest.headers;
        var params = appRequest.body.PARAMS;

        var allChild = [];
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            var APPU_ID = sessionInfo.APPU_ID;
            var APPID = sessionInfo.APP_ID
            DBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConnclt(pClientclt) {

                getappusersta();

                function _printInfo(message, objLogInfo) {
                    reqInstanceHelper.PrintInfo(serviceName, message, objLogInfo);
                }


                function getappusersta() {
                    try {
                        DBInstance.GetTableFromFXDB(pClientclt, 'APP_USER_STS', [], {
                            appu_id: APPU_ID
                        }, objLogInfo, function callbackAPPUSERSTSSEL(error, pAppureslt) {
                            if (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-0002', 'Error while getting details from app_user_sts', error);
                            } else {
                                var arrappstsid = new reqLINQ(pAppureslt.rows)
                                    .Select(function (u) {
                                        return u.appsts_id;
                                    }).ToArray();
                                var filterCondition = {
                                    app_id: APPID,
                                    // cluster_code:params.ClusterCode,
                                    appsts_id: arrappstsid
                                };

                                getsysInfo(filterCondition).catch(function (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, 'FAILURE', objLogInfo, 'ERR-AUT-001', 'Error occurec getsysInfo function ', error, 'FAILURE');
                                });


                            }
                        });
                    } catch (error) {

                    }
                }

                function getsysInfo(Condob) {
                    return new Promise((resolve, reject) => {
                        try {
                            _printInfo('getsysInfo function executing', objLogInfo);
                            // var Condob = {};
                            // Condob.cluster_code = ParamsInfo.ClusterCode;
                            // Condob.app_id = ParamsInfo.Appid;

                            DBInstance.GetTableFromFXDB(pClientclt, 'APP_SYSTEM_TO_SYSTEM', ['s_id', 'parent_s_id', 's_code', 'st_code', 's_description', 'st_id', 'sts_id'], Condob, objLogInfo, function (err, pRes) {
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

                                            Getallchild(appstsRows, params.SId);

                                            function Getallchild(fullRows, currSid) {

                                                for (var j = 0; j < fullRows.length; j++) {
                                                    if (fullRows[j].parent_s_id == currSid) {
                                                        allChild.push(fullRows[j]);
                                                        Getallchild(fullRows, fullRows[j].s_id);
                                                    }
                                                }
                                            }

                                            var currentObj = appstsRows.filter((sRow) => {
                                                return sRow.s_id === params.SId
                                            })
                                            allChild.push(currentObj[0]);

                                            var pReqObj = {};
                                            pReqObj.resultRows = allChild;
                                            pReqObj.curParentSID = params.SId;
                                            pReqObj.resultSId = [];


                                            reqInstanceHelper.SendResponse(serviceName, appResponse, pReqObj, objLogInfo, '', '', '', 'SUCCESS');
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
                            .Select(function (data) {
                                return data.st_id;
                            })
                            .ToArray();

                        DBInstance.GetTableFromFXDB(pClientclt, 'SYSTEM_TYPES', ['st_description', 'st_id', 'st_code'], {
                            st_id: SysIDs
                        }, objLogInfo, function (pErr, pResult) {
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