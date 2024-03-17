var reqExpress = require('express');
var router = reqExpress.Router();

var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
router.get('/exportTables', function (appRequest, appResponse) {
    try {
        var serviceName = 'exportTables';
        var objLogInfo = null;
        var reqLINQ = require('node-linq').LINQ;
        var reqPath = require('path');
        var reqFS = require('fs');
        var reqOS = require('os');
        var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
        var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
        var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
        var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
        //Global Variable
        var u_id = [];
        var appu_id = [];
        var appsts_id = [];
        var appst_id = [];
        var appr_id = [];
        var s_id = [];
        var st_id = [];
        var sts_id = [];
        var lds_group = [];
        var ld_code = [];
        var language_code = [];
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                var params = appRequest.query;
                var paramcond = JSON.parse(params.COND);
                var headers = appRequest.headers;
                // headers.routingkey = params.ROUTING_KEY; //this is not solution
                var client_id = objSessionInfo.CLIENT_ID ? objSessionInfo.CLIENT_ID : '0';
                var tenant_id = objSessionInfo.TENANT_ID ? objSessionInfo.TENANT_ID : '0';
                var app_id = objSessionInfo.APP_ID ? objSessionInfo.APP_ID : '0';
                var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
                var fromPage = params.PAGE;
                var keySpace = 'dep_cas';
                var arrayForExport = [];
                var fileName = 'temp.json';
                var schemaname = 'clt_cas';
                var tablename = 'tenant_setup';
                var selectQuery = '';
                var condparams = {
                    tenant_id: tenant_id,
                    client_id: client_id,
                    category: 'ADMIN_EXPORT_IMPORT'
                };
                if (fromPage === 'aceEditor') {
                    schemaname = 'dep_cas';
                    tablename = 'code_snippets';

                    condparams = {
                        app_id: app_id,
                    }


                    if (Object.keys(paramcond).length != 0 && paramcond.snippet_id != '') {
                        condparams.snippet_id = paramcond.snippet_id ? paramcond.snippet_id : ''
                    }
                }

                if (fromPage === 'archivalsetup') {
                    schemaname = 'dep_cas';
                    tablename = 'ARCHIVAL_SETUP';

                    condparams = {
                        app_id: app_id,
                    }
                }
                if (fromPage === 'connectorsetup') {
                    schemaname = 'dep_cas';
                    tablename = 'CONNECTORS';

                    condparams = {}
                }

                reqDBInstance.GetFXDBConnection(headers, schemaname, objLogInfo, function (cltClient) {
                    try {
                        reqDBInstance.GetTableFromFXDB(cltClient, tablename, [], condparams, objLogInfo, function (error, result) {
                            try {
                                if (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                } else {
                                    var tableDetails = result.rows[0].setup_json ? JSON.parse(result.rows[0].setup_json) : {};
                                    if (fromPage == 'aceEditor') {
                                        tableDetails = result.rows;
                                    }
                                    if (fromPage === 'archivalsetup') {
                                        tableDetails = result.rows;
                                    }

                                    if (fromPage === 'connectorsetup') {
                                        tableDetails = result.rows;
                                    }
                                    switch (fromPage.toLowerCase()) {
                                        case 'localization':
                                            keySpace = 'clt_cas';
                                            arrayForExport = tableDetails.localization;
                                            fileName = 'localization.json';
                                            break;
                                        case 'exchange':
                                            keySpace = 'dep_cas';
                                            arrayForExport = tableDetails.exchange;
                                            fileName = 'exchange.json';
                                            break;
                                        case 'scheduler':
                                            keySpace = 'dep_cas';
                                            arrayForExport = tableDetails.scheduler;
                                            fileName = 'scheduler.json';
                                            break;
                                        case 'report':
                                            keySpace = 'dep_cas';
                                            arrayForExport = tableDetails.report;
                                            fileName = 'report.json';
                                            break;
                                        case 'communication':
                                            keySpace = 'dep_cas';
                                            arrayForExport = tableDetails.communication;
                                            fileName = 'communication.json';
                                            break;
                                        case 'user':
                                            keySpace = 'clt_cas';
                                            arrayForExport = tableDetails.user;
                                            fileName = 'user.json';
                                            break;
                                        case 'tenant':
                                            keySpace = 'clt_cas';
                                            arrayForExport = tableDetails.tenant;
                                            fileName = (JSON.parse(params.COND)).category ? (JSON.parse(params.COND)).category + '.json' : 'tenant.json';
                                            break;
                                        case 'scan':
                                            keySpace = 'clt_cas';
                                            arrayForExport = tableDetails.scan;
                                            fileName = 'scan.json';
                                            break;
                                        case 'comment':
                                            keySpace = 'clt_cas';
                                            arrayForExport = tableDetails.comment;
                                            fileName = 'comment.json';
                                            break;
                                        case 'aceeditor':
                                            keySpace = 'dep_cas';
                                            arrayForExport = tableDetails;
                                            fileName = (JSON.parse(params.COND)).snippet_name ? (JSON.parse(params.COND)).snippet_name + '.json' : 'wpcustomprojects.json';
                                            break;
                                        case 'archivalsetup':
                                            keySpace = 'dep_cas';
                                            arrayForExport = tableDetails;
                                            fileName = (JSON.parse(params.COND)).snippet_name ? (JSON.parse(params.COND)).snippet_name + '.json' : 'ArchivalSetup.json';
                                            break;
                                        case 'connectorsetup':
                                            keySpace = 'dep_cas';
                                            arrayForExport = tableDetails;
                                            fileName = (JSON.parse(params.COND)).snippet_name ? (JSON.parse(params.COND)).snippet_name + '.json' : 'ConnectorSetup.json';
                                            break;
                                    }
                                    doExport()
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                            }
                        });

                        function doExport() {
                            try {
                                reqDBInstance.GetFXDBConnection(headers, keySpace, objLogInfo, function (pClient) {
                                    try {
                                        var i = 0;
                                        var langIndex = 0;
                                        if (arrayForExport.length > i && fromPage != 'aceEditor' && fromPage != "archivalsetup" && fromPage != "connectorsetup") {
                                            exportData(arrayForExport[i]);
                                        } else {
                                            finalProcess();
                                        }


                                        function exportData(tableDetail) {
                                            try {
                                                i++;
                                                var executeQuery = true;
                                                var tableName = tableDetail.tableName;
                                                var keyCols = tableDetail.keyCols;
                                                var isTranDB = tableDetail.tranDB ? tableDetail.tranDB : false;
                                                var data = {
                                                    client_id: client_id,
                                                    app_id: app_id,
                                                    tenant_id: tenant_id
                                                }
                                                var cond = params.COND ? JSON.parse(params.COND) : {};
                                                if (tableName.toLowerCase() != 'tenant_setup') { // this is temp for single tenant update
                                                    cond = {};
                                                }
                                                // For Dynamically Updating the Query condition object 
                                                switch (fromPage.toLowerCase()) {
                                                    case 'tenant':
                                                        cond['tenant_id'] = tenant_id;
                                                        cond['client_id'] = client_id;
                                                        break;

                                                    case 'user':
                                                        switch (tableName.toLowerCase()) {
                                                            case 'app_users':
                                                            case 'app_system_to_system':
                                                                cond = {
                                                                    app_id: app_id
                                                                }
                                                                break;
                                                            case 'users':
                                                                u_id = removeDuplicates(u_id);
                                                                cond = {
                                                                    client_id: client_id,
                                                                    u_id: u_id
                                                                }
                                                                break;
                                                            case 'app_user_roles':
                                                                appu_id = removeDuplicates(appu_id);
                                                                cond = {
                                                                    appu_id: appu_id
                                                                }
                                                                break;
                                                            case 'app_user_sts':
                                                                appu_id = removeDuplicates(appu_id);
                                                                cond = {
                                                                    appu_id: appu_id
                                                                }
                                                                break;
                                                            case 'app_system_to_system_roles':
                                                                appsts_id = removeDuplicates(appsts_id);
                                                                cond = {
                                                                    appsts_id: appsts_id
                                                                }
                                                                break;
                                                            case 'systems':
                                                                s_id = removeDuplicates(s_id);
                                                                cond = {
                                                                    s_id: s_id
                                                                }
                                                                break;
                                                            case 'system_types':
                                                                cond = {
                                                                    client_id: client_id
                                                                }
                                                                break;
                                                            case 'system_to_system':
                                                                sts_id = removeDuplicates(sts_id);
                                                                cond = {
                                                                    sts_id: sts_id
                                                                }
                                                                break;
                                                            case 'app_system_types':
                                                                appst_id = removeDuplicates(appst_id);
                                                                cond = {
                                                                    appst_id: appst_id
                                                                }
                                                                break;
                                                            case 'clusters':
                                                                cond = {
                                                                    client_id: client_id
                                                                }
                                                                break;
                                                            case 'last_pwd_creation':
                                                                u_id = removeDuplicates(u_id);
                                                                cond = {
                                                                    u_id: u_id
                                                                }
                                                                break;
                                                            case 'app_roles':
                                                                appr_id = removeDuplicates(appr_id);
                                                                cond = {
                                                                    app_id: app_id,
                                                                    appr_id: appr_id
                                                                }
                                                                break;
                                                        }
                                                        break
                                                    case 'scheduler':
                                                        if (tableName.toLowerCase() == 'sch_batch') {
                                                            cond = {};
                                                        } else {
                                                            cond['app_id'] = app_id;
                                                        }
                                                        break;
                                                    case 'communication':
                                                        cond = {
                                                            creation_mode: 'RUN_TIME',
                                                            app_id: app_id
                                                        }
                                                        break;
                                                    case 'exchange':
                                                        cond = {
                                                            client_id: client_id,
                                                            app_id: app_id
                                                        }
                                                        break;
                                                        case 'report':
                                                        cond = {
                                                            app_id: app_id
                                                        }
                                                        break;
                                                    case 'comment':
                                                        cond['app_id'] = app_id;
                                                        break;
                                                    case 'localization':
                                                        switch (tableName.toLowerCase()) {
                                                            case 'language_dictionary':
                                                                var ld_codeDataToString = getLdCodeString(ld_code);
                                                                selectQuery = "select * from " + tableName + " where app_id = " + "'" + app_id + "'" + " and  client_id = " + "'" + client_id + "'" + " or ld_code in ( " + ld_codeDataToString + ")";
                                                                break;
                                                            case 'language_dictionary_source':
                                                                selectQuery = "select * from " + tableName + " where app_id = " + "'" + app_id + "'" + " and  client_id = " + "'" + client_id + "'" + " or lds_group = 'STATIC WEB'";
                                                                break;
                                                            case 'language_dictionary_json':
                                                                language_code = removeDuplicates(language_code);
                                                                lds_group = removeDuplicates(lds_group);
                                                                executeQuery = false;
                                                                langIndex = 0;
                                                                if (language_code.length > langIndex) {
                                                                    languageCodeElement(language_code[langIndex]);
                                                                } else {
                                                                    languageCodeElement('');
                                                                }
                                                                break;
                                                        }
                                                        break;

                                                }
                                                if (executeQuery) {
                                                    queryExec(cond, false);
                                                }

                                                function languageCodeElement(element) {
                                                    langIndex++;
                                                    cond = {
                                                        language_code: element,
                                                        client_id: client_id,
                                                        group: lds_group
                                                    }
                                                    queryExec(cond, true);
                                                }
                                                //Remove Duplicated Elements within the Array ['a','b','a']
                                                function removeDuplicates(fullArray) {
                                                    fullArray = fullArray.filter(function (elem, pos) {
                                                        return fullArray.indexOf(elem) == pos;
                                                    })
                                                    return fullArray;
                                                }

                                                function getDataFromResult(currentObj) {
                                                    switch (tableName.toLowerCase()) {
                                                        case 'app_users':
                                                            if (currentObj.u_id && currentObj.appu_id) {
                                                                u_id.push(currentObj.u_id);
                                                                appu_id.push(currentObj.appu_id);
                                                            }
                                                            break;
                                                        case 'app_user_roles':
                                                            if (currentObj.appr_id) {
                                                                appr_id.push(currentObj.appr_id);
                                                            }
                                                            break;
                                                        case 'app_user_sts':
                                                            if (currentObj.appsts_id) {
                                                                appsts_id.push(currentObj.appsts_id);
                                                            }
                                                            break;
                                                        case 'app_system_to_system':
                                                            if (currentObj.s_id && currentObj.sts_id && currentObj.appst_id) {
                                                                s_id.push(currentObj.s_id);
                                                                sts_id.push(currentObj.sts_id);
                                                                appst_id.push(currentObj.appst_id);
                                                            }
                                                            break;
                                                        case 'app_system_types':
                                                            if (currentObj.st_id) {
                                                                st_id.push(currentObj.st_id);
                                                            }
                                                            break;
                                                        case 'language_dictionary_source':
                                                            if (currentObj.lds_group) {
                                                                lds_group.push(currentObj.lds_group);
                                                                ld_code.push(currentObj.ld_code);
                                                            }
                                                            break;
                                                        case 'language_dictionary':
                                                            if (currentObj.language_code) {
                                                                language_code.push(currentObj.language_code);
                                                            }
                                                            break;
                                                    }
                                                }

                                                function queryExec(query, isFromLanguage_dictionary_json) {
                                                    var queryCond = query;

                                                    if (!isTranDB) {
                                                        if (fromPage.toLowerCase() == 'localization' & tableName.toLowerCase() == 'language_dictionary' || tableName.toLowerCase() == 'language_dictionary_source') {
                                                            executeStaticQuery();
                                                        } else {
                                                            reqDBInstance.GetTableFromFXDB(pClient, tableName, [], queryCond, objLogInfo, function (error, result) {
                                                                try {
                                                                    if (error) {
                                                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                                                    } else {
                                                                        if (result.rows.length) {
                                                                            result.rows = new reqLINQ(result.rows)
                                                                                .Where(function (item) {
                                                                                    var addIt = true;
                                                                                    if (fromPage.toLowerCase() == 'user') {
                                                                                        switch (tableName.toLowerCase()) {
                                                                                            case 'app_users':
                                                                                            case 'app_user_roles':
                                                                                            case 'app_user_sts':
                                                                                            case 'app_system_to_system':
                                                                                            case 'app_system_types':
                                                                                                getDataFromResult(item);
                                                                                        }
                                                                                    } else if (fromPage.toLowerCase() == 'scheduler' && tableName.toLowerCase() == 'sch_batch') {
                                                                                        if (item['app_id'] !== app_id.toString()) {
                                                                                            addIt = false;
                                                                                        }
                                                                                    } else if (fromPage.toLowerCase() == 'communication') {
                                                                                        if (item['app_id'] !== app_id.toString()) {
                                                                                            addIt = false;
                                                                                        }
                                                                                    } else if (!isFromLanguage_dictionary_json) {
                                                                                        for (var col in cond) {
                                                                                            if (item[col] != cond[col]) {
                                                                                                addIt = false;
                                                                                                break;
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                    return addIt;
                                                                                }).ToArray();
                                                                            tableDetail.data = result.rows;
                                                                            if (!isFromLanguage_dictionary_json) {
                                                                                finalProcess();
                                                                            } else {
                                                                                if (language_code.length > langIndex) {
                                                                                    languageCodeElement(language_code[langIndex]);
                                                                                } else {
                                                                                    finalProcess();
                                                                                }
                                                                            }
                                                                        } else {
                                                                            tableDetail.data = result.rows;
                                                                            finalProcess();
                                                                        }
                                                                    }
                                                                } catch (error) {
                                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                                                }
                                                            });
                                                        }

                                                    } else {
                                                        if (fromPage.toLowerCase() == 'localization' & tableName.toLowerCase() == 'language_dictionary_json') {
                                                            reqDBInstance.GetTableFromFXDB(pClient, tableName, [], queryCond, objLogInfo, function (error, result) {
                                                                try {
                                                                    if (error) {
                                                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                                                    } else {
                                                                        if (result.rows.length) {
                                                                            tableDetail.data = result.rows;
                                                                            if (!isFromLanguage_dictionary_json) {
                                                                                finalProcess();
                                                                            } else {
                                                                                if (language_code.length > langIndex) {
                                                                                    languageCodeElement(language_code[langIndex]);
                                                                                } else {
                                                                                    finalProcess();
                                                                                }
                                                                            }
                                                                        } else {
                                                                            tableDetail.data = result.rows;
                                                                            if (!isFromLanguage_dictionary_json) {
                                                                                finalProcess();
                                                                            } else {
                                                                                if (language_code.length > langIndex) {
                                                                                    languageCodeElement(language_code[langIndex]);
                                                                                } else {
                                                                                    finalProcess();
                                                                                }
                                                                            }
                                                                        }
                                                                    }
                                                                } catch (error) {
                                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                                                }
                                                            });
                                                        } else if (fromPage.toLowerCase() == 'localization' & tableName.toLowerCase() == 'language_dictionary' || tableName.toLowerCase() == 'language_dictionary_source') {
                                                            executeStaticQuery();
                                                        } else {
                                                            reqTranDBInstance.GetTranDBConn(headers, false, function (pSession) {
                                                                try {
                                                                    reqTranDBInstance.GetTableFromTranDB(pSession, tableName, queryCond, objLogInfo, function (result, error) {
                                                                        try {
                                                                            if (error) {
                                                                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                                                            } else {
                                                                                if (result.length) {
                                                                                    result = new reqLINQ(result)
                                                                                        .Where(function (item) {
                                                                                            if (fromPage.toLowerCase() == 'user') {
                                                                                                switch (tableName.toLowerCase()) {
                                                                                                    case 'app_users':
                                                                                                    case 'app_user_roles':
                                                                                                    case 'app_user_sts':
                                                                                                    case 'app_system_to_system':
                                                                                                    case 'app_system_types':
                                                                                                        getDataFromResult(item);
                                                                                                }
                                                                                            }
                                                                                            return true;
                                                                                        }).ToArray();
                                                                                    tableDetail.data = result;
                                                                                    finalProcess();
                                                                                } else {
                                                                                    tableDetail.data = result;
                                                                                    finalProcess();
                                                                                }
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
                                                    }
                                                }

                                                function executeStaticQuery() {
                                                    reqTranDBInstance.GetTranDBConn(headers, false, function (pSession) {
                                                        reqTranDBInstance.ExecuteSQLQuery(pSession, selectQuery, objLogInfo, function (result, error) {
                                                            if (error) {
                                                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                                            } else {
                                                                if (result.rows.length) {
                                                                    result.rows = new reqLINQ(result.rows)
                                                                        .Where(function (item) {
                                                                            getDataFromResult(item);
                                                                            return true;
                                                                        }).ToArray();
                                                                    tableDetail.data = result.rows;
                                                                    finalProcess();
                                                                } else {
                                                                    tableDetail.data = result.rows;
                                                                    finalProcess();
                                                                }
                                                            }
                                                        });
                                                    });
                                                }

                                            } catch (error) {
                                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                            }
                                        }

                                        function getLdCodeString(arr) {
                                            arr.forEach((elem, i) => {
                                                arr[i] = "'" + elem + "'"
                                            })
                                            return arr;
                                        }

                                        function finalProcess() {
                                            try {
                                                if (arrayForExport.length > i && fromPage != 'aceEditor' && fromPage != "archivalsetup" && fromPage != "connectorsetup") {
                                                    exportData(arrayForExport[i]);
                                                } else {
                                                    var data = {
                                                        'keySpace': keySpace,
                                                        'tenant_id': tenant_id,
                                                        'data': arrayForExport

                                                    }
                                                    if (fromPage == 'aceEditor') {
                                                        var data = [{
                                                            'tableName': tablename,
                                                            'keyCols': ['snippet_id', 'app_id', 'snippet_name'],
                                                            'data': arrayForExport,
                                                        }]

                                                        data = {
                                                            'keySpace': keySpace,
                                                            'tenant_id': tenant_id,
                                                            'data': data,
                                                        }
                                                    }

                                                    if (fromPage == 'archivalsetup') {
                                                        var data = [{
                                                            'tableName': tablename,
                                                            'keyCols': ['as_id'],
                                                            'data': arrayForExport,
                                                        }]

                                                        data = {
                                                            'keySpace': keySpace,
                                                            'tenant_id': tenant_id,
                                                            'data': data,
                                                        }
                                                    }

                                                    if (fromPage == 'connectorsetup') {
                                                        var data = [{
                                                            'tableName': tablename,
                                                            'keyCols': ['con_id'],
                                                            'data': arrayForExport,
                                                        }]

                                                        data = {
                                                            'keySpace': keySpace,
                                                            'tenant_id': tenant_id,
                                                            'data': data,
                                                        }
                                                    }
                                                    var strData = JSON.stringify(data);
                                                    var filePath = reqPath.resolve(reqOS.tmpdir() + reqPath.sep + fileName);
                                                    var buff = new Buffer.from(strData).toString("base64");
                                                    var response = {};
                                                    response.fileContent = strData;
                                                    response.fileName = fileName;
                                                    response.process_status = "SUCCESS";
                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, response, objLogInfo, '', '', '', "SUCCESS", '');
                                                }
                                            } catch (error) {
                                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                            }
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                                    }
                                });
                            } catch (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                            }
                        }
                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errCode', 'errMsg', error);
    }
});

module.exports = router;