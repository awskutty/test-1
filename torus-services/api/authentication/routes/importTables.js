var reqExpress = require('express');
var router = reqExpress.Router();

var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
router.post('/importTables', function (appRequest, appResponse) {
    try {
        var serviceName = 'importTables';
        var objLogInfo = null;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                var params = appRequest.body.PARAMS;
                var headers = appRequest.headers;
                const regex = /\.JSON$/i;
                const isJSON = regex.test(appRequest.files.FILE_0.name.toUpperCase());
                // if (appRequest.files.FILE_0.mimetype == 'application/json' && appRequest.files.FILE_0.name.search('.json') !== '') {
                if (appRequest.files.FILE_0.mimetype == 'application/json' && isJSON) {
                    var files = appRequest.files ? appRequest.files : {};
                    var fileArr = Object.keys(files);
                    var f = 0;
                    if (f < fileArr.length) {
                        doInsert(files[fileArr[f]]);
                    } else {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, 'No File Found');
                    }
                    function doInsert(currentFile) {
                        f++;
                        var jsonData = currentFile.data.toString().trim();
                        if (typeof jsonData == 'string') {
                            jsonData = JSON.parse(jsonData);
                        }
                        //var jsonData = JSON.parse(currentFile.data);//JSON.parse(params.FILE_DATA);
                        var client_id = objSessionInfo.CLIENT_ID ? objSessionInfo.CLIENT_ID : '0';
                        var tenant_id = objSessionInfo.TENANT_ID ? objSessionInfo.TENANT_ID : '0';
                        var app_id = objSessionInfo.APP_ID ? objSessionInfo.APP_ID : '0';
                        var created_by = objSessionInfo.LOGIN_NAME ? objSessionInfo.LOGIN_NAME : '';
                        var keySpace = jsonData.keySpace;
                        var jsonTenantId = jsonData.tenant_id ? jsonData.tenant_id : '0';
                        var arrayForImport = jsonData.data;
                        //console.log('tenant_id', jsonTenantId, '=', tenant_id);
                        if (jsonTenantId == tenant_id) {
                            reqDBInstance.GetFXDBConnection(headers, keySpace, objLogInfo, function (pClient) {
                                try {
                                    var i = 0;
                                    if (arrayForImport.length > i) {
                                        importDatas(arrayForImport[i]);
                                    }
                                    function importDatas(tableDetail) {
                                        try {
                                            i++;
                                            var tableName = tableDetail.tableName;
                                            var dataArr = tableDetail.data;
                                            var keyCols = tableDetail.keyCols;
                                            var isTranDB = tableDetail.tranDB ? tableDetail.tranDB : false;
                                            var j = 0;
                                            if (dataArr.length > j) {
                                                importCurrData(dataArr[j]);
                                            } else {
                                                finalProcess();
                                            }
                                            function importCurrData(data) {
                                                try {
                                                    j++;
                                                    var cond = {};
                                                    for (var k = 0; k < keyCols.length; k++) {
                                                        var col = keyCols[k];
                                                        cond[col] = data[col];
                                                    }
                                                    //for audit columns and date conversion
                                                    if (data.client_id) {
                                                        data.client_id = client_id;
                                                    }
                                                    if (data.tenant_id) {
                                                        data.tenant_id = tenant_id;
                                                    }
                                                    if (data.app_id) {
                                                        data.app_id = app_id;
                                                    }
                                                    if (data.created_by) {
                                                        data.created_by = created_by;
                                                    }
                                                    // if (data.created_date) {
                                                    //     data.created_date = reqDateFormatter.GetTenantCurrentDateTime(headers, objLogInfo);
                                                    // }
                                                    if (data.modified_by) {
                                                        data.modified_by = null;
                                                    }
                                                    if (data.modified_date) {
                                                        data.modified_date = null;
                                                    }
                                                    if (data.start_active_date) {
                                                        data.start_active_date = reqDateFormatter.ConvertDate(data.start_active_date, headers, null);
                                                    }
                                                    if (data.end_active_date) {
                                                        data.end_active_date = reqDateFormatter.ConvertDate(data.end_active_date, headers, null);
                                                    }
                                                    if (data.last_created_date) {
                                                        data.last_created_date = reqDateFormatter.ConvertDate(data.last_created_date, headers, null);
                                                    }
                                                    if (data.account_locked_date) {
                                                        data.account_locked_date = reqDateFormatter.ConvertDate(data.account_locked_date, headers, null);
                                                    }
                                                    if (data.last_successful_login) {
                                                        data.last_successful_login = reqDateFormatter.ConvertDate(data.last_successful_login, headers, null);
                                                    }
                                                    //for audit columns and date conversion
                                                    if (!isTranDB) {
                                                        reqDBInstance.DeleteFXDB(pClient, tableName, cond, objLogInfo, function (error, result) {
                                                            try {
                                                                if (error) {
                                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                                                } else {
                                                                    reqDBInstance.InsertFXDB(pClient, tableName, [data], objLogInfo, function (error, result) {
                                                                        try {
                                                                            if (error) {
                                                                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                                                            } else {
                                                                                if (dataArr.length > j) {
                                                                                    importCurrData(dataArr[j]);
                                                                                } else {
                                                                                    finalProcess();
                                                                                }
                                                                            }
                                                                        } catch (error) {
                                                                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                                                        }
                                                                    });
                                                                }
                                                            } catch (error) {
                                                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                                            }
                                                        });
                                                    } else {
                                                        reqTranDBInstance.GetTranDBConn(headers, false, function (pSession) {
                                                            try {
                                                                reqTranDBInstance.DeleteTranDB(pSession, tableName, cond, objLogInfo, function (result, error) {
                                                                    try {
                                                                        if (error) {
                                                                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                                                        } else {
                                                                            reqTranDBInstance.InsertTranDBWithAudit(pSession, tableName, [data], objLogInfo, function (result, error) {
                                                                                try {
                                                                                    if (error) {
                                                                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                                                                    } else {
                                                                                        if (dataArr.length > j) {
                                                                                            importCurrData(dataArr[j]);
                                                                                        } else {
                                                                                            finalProcess();
                                                                                        }
                                                                                    }
                                                                                } catch (error) {
                                                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                                                                }
                                                                            });
                                                                        }
                                                                    } catch (error) {
                                                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                                                    }
                                                                });
                                                            } catch (error) {
                                                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                                            }
                                                        });
                                                    }
                                                } catch (error) {
                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                                }
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                        }
                                    }
                                    function finalProcess() {
                                        try {
                                            if (arrayForImport.length > i) {
                                                importDatas(arrayForImport[i]);
                                            } else {
                                                if (f < fileArr.length) {
                                                    doInsert(files[fileArr[f]]);
                                                } else {
                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, arrayForImport);
                                                }
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                        }
                                    }
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                }
                            });
                        } else {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, '', '', 'Tenant id not matched');
                        }
                    }
                } else {
                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUTH-415', 'Unsupported file type', 'or format');
                }

            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
    }
});

module.exports = router;