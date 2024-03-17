/*
@Api_Name         : /ArchivalIndex,
@Description      : To load dt info in archival setup 
@Last_Error_code  : ERR-HAN-
*/


// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
router.post('/LoadDTinfo', function (appRequest, appResponse) {
    try {
        var objLogInfo = {};
        var pHeaders = appRequest.headers;
        var ServiceName = 'LoadDTinfo';
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                var cond = { app_id: objLogInfo.APP_ID };
                var params = appRequest.body.PARAMS;
                var tableType = params.Type || "DYNAMIC";
                if (tableType == "DYNAMIC") {
                    _getDynamicTable();
                } else if (tableType == 'FX_TABLE') {
                    _getFxTables();
                } else {
                    _getStaticTables();
                }

                function _getDynamicTable() {
                    try {
                        reqDBInstance.GetTableFromFXDB(pClient, "DT_INFO", [], cond, objLogInfo, function (perr, pRes) {
                            if (perr) {
                                var res = {};
                                res.errMessage = "Error occured while query DT_INFO";
                                res.errCode = "ERR-ARCH-45001";
                                res.errobj = perr;
                                sendFailureRespone(perr);
                            } else {
                                if (pRes.rows && pRes.rows.length) {
                                    prepareResult(pRes.rows);
                                }
                            }
                        });
                    } catch (error) {
                        var res = {};
                        res.errMessage = "Exception occured _getDynamicTable function";
                        res.errCode = "ERR-ARCH-45016";
                        res.errobj = error;
                        sendFailureRespone(res);
                    }
                };



                function _getStaticTables() {
                    // _getstaticTabledata(arrRes);
                    _getstaticTabledata().then(function (ststictables) {
                        var arrRes = [];
                        var staticTable = {};
                        staticTable.Type = "STATIC";
                        staticTable.DTCode = "ST";
                        staticTable.DTDesc = "STATIC";
                        //ststictables = reqInstanceHelper.ArrKeyToUpperCase(ststictables, objLogInfo);
                        var arrStaticRelJson = [];
                        for (var i = 0; i < ststictables.length; i++) {
                            var objstaticreljson = {};
                            objstaticreljson.TARGET_TABLE = ststictables[i].target_table;
                            objstaticreljson.PRIMARY_COLUMN = ststictables[i].key_column_name;
                            arrStaticRelJson.push(objstaticreljson);
                        }
                        staticTable.RelationJson = JSON.stringify(arrStaticRelJson);
                        arrRes.push(staticTable);
                        reqInstanceHelper.SendResponse(ServiceName, appResponse, arrRes, objLogInfo, '', '', '', '');
                    }).catch(function (err) {
                        sendFailureRespone(err);
                    });
                }

                function _getFxTables() {
                    try {
                        _getfxTables().then(function (fxTables) {
                            var arrRes = [];
                            var arrFxRelJson = [];
                            var fxtableobj = {};
                            fxtableobj.Type = "FX_TABLES";
                            fxtableobj.DTCode = "FX_TABLES";
                            fxtableobj.DTDesc = "FX_TABLES";
                            for (var i = 0; i < fxTables.length; i++) {
                                if (!fxTables[i].parent_table_name) {
                                    var objfxReljson = {};
                                    objfxReljson.TARGET_TABLE = fxTables[i].table_name;
                                    objfxReljson.PRIMARY_COLUMN = fxTables[i].key_column_name;
                                    objfxReljson.GROUP = fxTables[i].fx_group;
                                    arrFxRelJson.push(objfxReljson);
                                }
                            }
                            fxtableobj.RelationJson = JSON.stringify(arrFxRelJson);
                            arrRes.push(fxtableobj);
                            reqInstanceHelper.SendResponse(ServiceName, appResponse, arrRes, objLogInfo, '', '', '', '');
                        });
                    } catch (error) {
                        var res = {};
                        res.errMessage = "Exception occured _getFxTables function";
                        res.errCode = "ERR-ARCH-45015";
                        res.errobj = error;
                        sendFailureRespone(res);
                    }
                }


                function prepareResult(pData, TableType, dtCode, dtDesc) {
                    try {
                        var arrRes = [];
                        for (var i = 0; i < pData.length; i++) {
                            var objRes = {};
                            objRes.Type = "DYNAMIC";
                            objRes.DTCode = pData[i].dt_code;
                            objRes.DTDesc = pData[i].dt_description;
                            objRes.RelationJson = pData[i].relation_json;
                            arrRes.push(objRes);
                        }
                        reqInstanceHelper.SendResponse(ServiceName, appResponse, arrRes, objLogInfo, '', '', '', '');
                    } catch (error) {
                        var res = {};
                        res.errMessage = "Exception occured prepareResult function";
                        res.errCode = "ERR-ARCH-45002";
                        res.errobj = error;
                        sendFailureRespone(res);
                    }
                }

                function _getstaticTabledata() {
                    try {
                        return new Promise((resolve, reject) => {
                            reqDBInstance.GetTableFromFXDBNoCache(pClient, "ARC_STATIC_TABLES", [], {}, objLogInfo, function (perr, pRes) {
                                if (perr) {
                                    reject(perr);
                                } else {
                                    resolve(pRes.rows);
                                }
                            });
                        });
                    } catch (error) {
                        var res = {};
                        res.errMessage = "Exception occured _getstaticTabledata function";
                        res.errCode = "ERR-ARCH-45017";
                        res.errobj = error;
                        reject(res);
                    }
                };


                function _getfxTables() {
                    return new Promise((resolve, reject) => {
                        try {
                            reqDBInstance.GetTableFromFXDBNoCache(pClient, "ARC_FX_TABLES", [], {}, objLogInfo, function (perr, pRes) {
                                if (perr) {
                                    reject(perr);
                                } else {
                                    resolve(pRes.rows);
                                }
                            });
                        } catch (error) {
                            reject(error);
                        }
                    });
                }
            });
        });
        function sendFailureRespone(pres) {
            reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, pres.errCode, pres.errMessage, pres.errobj, 'FAILURE');
        }
    } catch (error) {
        var res = {};
        res.errMessage = "Exception occured _getstaticTabledata function";
        res.errCode = "ERR-ARCH-45017";
        res.errobj = error;
        sendFailureRespone(res);
    }

});
module.exports = router;