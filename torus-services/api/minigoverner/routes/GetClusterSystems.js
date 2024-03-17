var node_modules = '../../../../node_modules/';
var referenceRoot = '../../../../torus-references';
var reqExpress = require(node_modules + 'express');
var router = reqExpress.Router();
var reqclusterDetails = require('../routes/GetClusterDetails');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLINQ = require('node-linq').LINQ;
var arrayToTree = require(node_modules + 'array-to-tree');
var serviceName = "GetClusterSystems";
var allChild = [];
//API call
router.post('/GetClusterSystems', function (appRequest, appResponse, pNext) {
    var objLogInfo;
    var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);

        objLogInfo.HANDLER_CODE = 'GetClusterSystems';
        objLogInfo.PROCESS = 'GetClusterSystems-Minigoverner';
        objLogInfo.ACTION_DESC = 'GetClusterSystems';

        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        try {
            var mHeaders = appRequest.headers;
            reqInstanceHelper.PrintInfo(serviceName, 'Getting FXDB COnnection', objLogInfo);
            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                var mCltClient = pCltClient;
                appResponse.setHeader('Content-Type', 'application/json');

                // Initialize Global variables
                var Ismultiapp = objSessionInfo.IS_MULTIAPP;
                // var Ismultiapp='Y';
                var strInputParam = appRequest.body.PARAMS;
                var App_id = strInputParam.APP_ID || objSessionInfo.APP_ID;
                var sID = objSessionInfo.S_ID;

                var showAllTabs = strInputParam.ShowTabs;
                var tabName = strInputParam.CurrentTab || '';
                var clusterfilter = {};
                var APPU_ID = objSessionInfo.APPU_ID;

                // var APPID = sessionInfo.APP_ID
                //var resinfo = new resultinfo();
                reqInstanceHelper.PrintInfo(serviceName, 'Calling appSystemtoSytem method', objLogInfo);
                var TableName = '';
                var selectQuery
                if (Ismultiapp == 'Y' && tabName == 'CLUSTER') {
                    selectQuery = {
                        query: `select s.s_id,s.s_description,s.st_id,sts.sts_id,sts.child_s_id,sts.cluster_code,sts.parent_s_id,sts.db_s_id,sts.is_default,s.created_by,s.created_date,s.modified_by,s.modified_date,s.version_no from system_to_system sts inner join systems s on s.s_id = sts.child_s_id where sts.cluster_code = ? order by sts.sts_id asc`,
                        params: [strInputParam.clusterCode]
                    }
                } else {
                    selectQuery = {
                        query: `select s.s_id,s.s_description,s.st_id,asts.s_code,asts.app_id,asts.sts_id,asts.appst_id,asts.st_code,asts.cluster_code,asts.child_s_id,asts.parent_s_id,asts.appsts_id,asts.is_enabled,s.created_by,s.created_date,s.modified_by,s.modified_date,s.version_no from app_system_to_system asts inner join systems s on s.s_id = asts.s_id where asts.app_id = ? and asts.cluster_code = ? order by asts.sts_id asc`,
                        params: [App_id, strInputParam.clusterCode]
                    }
                }

                try {
                    reqFXDBInstance.ExecuteSQLQueryWithParams(mCltClient, selectQuery, objLogInfo, function caLlbacklitefiler(result, err) {
                        try {
                            if (result) {
                                var data = {};
                                var sys = [];
                                var newarr = [];
                                data.has_SysParent = "N";
                                if (result.rows.length > 0) {
                                    data.has_SysParent = "Y";
                                    if (Ismultiapp == "Y" && tabName == 'CLUSTER') {
                                        checkappsts(result, function (res) {
                                            objKeyUppercase(result.rows);
                                        });
                                    } else {
                                        objKeyUppercase(result.rows);
                                    }


                                    function objKeyUppercase(pRows) {
                                        try {
                                            newarr = [];
                                            for (var j = 0; j < pRows.length; j++) {
                                                var key, keys = Object.keys(pRows[j]);
                                                var n = keys.length;
                                                var newobj = {};
                                                while (n--) {
                                                    key = keys[n];
                                                    if (key == 'child_s_description') {
                                                        newobj['S_DESCRIPTION'] = pRows[j][key];
                                                    } else {
                                                        newobj[key.toUpperCase()] = pRows[j][key];
                                                    }
                                                }
                                                newobj['id'] = j;
                                                newobj['label'] = newobj['S_DESCRIPTION'];
                                                newobj['children'] = [];
                                                newobj['expanded'] = true;
                                                newobj[key.toUpperCase()] = pRows[j][key];
                                                newarr.push(newobj);
                                            }
                                            if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0' && tabName != 'CLUSTER' && !showAllTabs) {
                                                if (newarr.length > 0) {
                                                    // var clusterinfo = newarr;
                                                    // var temparr = [];
                                                    // var currentObj = clusterinfo.filter((sRow) => {
                                                    //     return sRow.CHILD_S_ID === sID;
                                                    // });
                                                    // if (currentObj.length > 0) {
                                                    //     temparr.push(currentObj[0]);
                                                    // }
                                                    // Getallchild(clusterinfo, sID);

                                                    // function Getallchild(clusterinfo, currSid) {
                                                    //     for (var j = 0; j < clusterinfo.length; j++) {
                                                    //         if (clusterinfo[j].PARENT_S_ID == currSid) {
                                                    //             if (temparr.indexOf(clusterinfo[j]) == -1) {
                                                    //                 temparr.push(clusterinfo[j]);
                                                    //             }
                                                    //             Getallchild(clusterinfo, clusterinfo[j].S_ID);
                                                    //         }
                                                    //     }
                                                    // }



                                                    // newarr = [];

                                                    // newarr = temparr;
                                                    var sysTree = arrayToTree(newarr, {
                                                        parentProperty: 'PARENT_S_ID',
                                                        customID: 'CHILD_S_ID'
                                                    });

                                                    data.CLUSTER_SYSTEMS = sysTree;
                                                    sendRes(data);
                                                } else {

                                                    data.CLUSTER_SYSTEMS = [];
                                                    sendRes(data);

                                                }

                                            } else {
                                                var sysTree = arrayToTree(newarr, {
                                                    parentProperty: 'PARENT_S_ID',
                                                    customID: 'CHILD_S_ID'
                                                });

                                                data.CLUSTER_SYSTEMS = sysTree;
                                                sendRes(data);
                                            }



                                        } catch (error) {
                                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured objKeyUppercase', error, '', '');
                                        }
                                    }
                                } else {
                                    sendRes(data);
                                }
                            }
                            else {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error Ocuured Get System table ', err, '', '');
                            }
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured Get System table', error, '', '');
                        }
                    });


                    function checkappsts(stsRows, pcallback) {
                        try {
                            var cond = {
                                'app_id': App_id,
                                'cluster_code': strInputParam.clusterCode || ""
                            };
                            reqFXDBInstance.GetTableFromFXDB(mCltClient, 'app_system_to_system', [], cond, objLogInfo, function callbackgetsyst(error, AppstsRow) {
                                if (error) {

                                } else {
                                    for (var i = 0; i < stsRows.rows.length; i++) {
                                        var AppstsInfo = new reqLINQ(AppstsRow.rows)
                                            .Where(function (res) {
                                                return res.sts_id == stsRows.rows[i].sts_id;
                                            }).ToArray();

                                        if (AppstsInfo.length > 0) {
                                            stsRows.rows[i]["APPSTS_ID"] = AppstsInfo[0].appsts_id;
                                            stsRows.rows[i]["expanded"] = true;
                                            stsRows.rows[i]["data"] = AppstsInfo[0].appsts_id;
                                            stsRows.rows[i]["ST_ID"] = AppstsInfo[0].st_id;
                                            stsRows.rows[i]["IS_ENABLED"] = AppstsInfo[0].is_enabled;
                                        }
                                    }
                                    pcallback();
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured checkappsts', error, '', '');
                        }
                    }

                    function sendRes(data) {
                        try {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, data, objLogInfo, null, null, null);
                        } catch (error) {

                        }
                    }

                    // }
                } catch (error) {
                    reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while GetFXDBConnection ', error, '', '');
                }
                // })
            });
        } catch (error) {
            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while GetFXDBConnection ', error, '', '');
        }
    });
});

module.exports = router;