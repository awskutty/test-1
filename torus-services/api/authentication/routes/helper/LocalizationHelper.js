/*
 * @Description: This is helper file for localization api
 * @Last_Error_code:ERR-AUT-110999
 */
var serviceName = 'LocalizationHelper';
var reqLinq = require('node-linq').LINQ;
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');

function loadLanguageGroupKey(params, headers, objLogInfo, callback) {
    try {
        reqDBInstance.GetFXDBConnection(headers, 'dev_cas', objLogInfo, function (pSession) {
            try {
                reqDBInstance.GetTableFromFXDB(pSession, 'code_descriptions', ['code_value'], { cd_code: 'LOCALIZATION' }, objLogInfo, function (error, result) {
                    try {
                        if (error) {
                            return callback(error);
                        } else {
                            if (result.rows.length > 0) {
                                var res = {};
                                res.CODE_DESCRIPTION = JSON.parse(result.rows[0].code_value);
                                return callback(null, res);
                            } else {
                                return callback('No Rows Found ');
                            }
                        }
                    } catch (error) {
                        return callback(error);
                    }
                });
            } catch (error) {
                return callback(error);
            }
        });
    } catch (error) {
        return callback(error);
    }
}

function loadLD(params, pHeaders, objLogInfo, callback) {
    try {
        var search = params.SEARCH;
        var clientId = params.CLIENT_ID;
        var appId = params.APP_ID;
        var langcode = params.LD_CODE;
        var recordsPerPage = params.RECORD_PER_PAGE;
        var currentPage = params.PAGE_NO;
        reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
            try {
                var selectQuery = 'select distinct lds.ld_code, lds.lds_group, ld.language_code, ld.ld_value from language_dictionary_source lds left join language_dictionary ld on lds.ld_code = ld.ld_code where (lds.client_id = \'' + clientId + '\' OR lds.lds_group = \'STATIC WEB\') and (lds.app_id = \'' + appId + '\' OR lds.lds_group = \'STATIC WEB\')';
                if (search != 'N') {
                    langcode = langcode.replace('?', '\\?');
                    selectQuery = selectQuery + ' and LOWER(lds.ld_code) like LOWER(\'' + langcode + '%\')';
                }
                selectQuery = selectQuery + ' order by lds.ld_code';
                reqTranDBInstance.ExecuteQueryWithPagingCount(pSession, selectQuery, currentPage, recordsPerPage, objLogInfo, function (pResult, pCount, error) {
                    try {
                        if (error) {
                            callback(error);
                        } else {
                            var response = {};
                            var ldArr = pResult;
                            var respArr = [];
                            for (var i = 0; i < ldArr.length; i++) {
                                var ldObj = ldArr[i];
                                var ldObjKeys = Object.keys(ldObj);
                                var respObj = {};
                                var merged = false;
                                for (var j = 0; j < ldObjKeys.length; j++) {
                                    var ldObjKey = ldObjKeys[j];
                                    if (ldObjKey.toUpperCase() == 'LD_VALUE') {
                                        continue;
                                    } else if (ldObjKey.toUpperCase() == 'LANGUAGE_CODE') {
                                        if (ldObj[ldObjKey]) {
                                            respObj[ldObj[ldObjKey]] = ldObj.ld_value;
                                            var existing = new reqLinq(respArr)
                                                .Where(function (data) {
                                                    return data.ld_code == respObj.ld_code;
                                                }).FirstOrDefault();
                                            if (existing) {
                                                merged = true;
                                                existing[ldObj[ldObjKey]] = ldObj.ld_value;
                                            }
                                        }
                                    } else {
                                        if (ldObj[ldObjKey]) {
                                            respObj[ldObjKey] = ldObj[ldObjKey];
                                        }
                                    }
                                }
                                if (!merged) {
                                    respArr.push(respObj);
                                }
                            }
                            var TotalNumOfDocs = pCount[0].count;
                            var VisibleDocCount = respArr.length;
                            var TotalNumOfPage = 0;
                            if (recordsPerPage > 0 && TotalNumOfDocs > recordsPerPage) {
                                TotalNumOfPage = parseInt(TotalNumOfDocs) / parseInt(recordsPerPage);
                                var Remain = parseInt(TotalNumOfDocs) % parseInt(recordsPerPage);
                                if (Remain > 0) {
                                    TotalNumOfPage = TotalNumOfPage + 1;
                                }
                            }
                            if (TotalNumOfPage == 0 || currentPage == 0) {//NeedFullDocs
                                currentPage = 1;
                                TotalNumOfPage = 1;
                            }
                            var RecordsFrom = 0;
                            if (recordsPerPage > 0 && currentPage > 0) {
                                var PageStart = currentPage * recordsPerPage;
                                if ((PageStart + 1) > 0 && (PageStart + 1) >= recordsPerPage) {
                                    RecordsFrom = ((PageStart + 1) - recordsPerPage);
                                } else {
                                    RecordsFrom = 1;
                                }
                            }
                            var SolrDocsLists = {};
                            SolrDocsLists.TotalNumberOfDocs = TotalNumOfDocs;
                            SolrDocsLists.VisibleDocCount = VisibleDocCount;
                            SolrDocsLists.RecordsPerPage = recordsPerPage;
                            SolrDocsLists.PageCount = TotalNumOfPage;
                            SolrDocsLists.CurrentPage = currentPage;
                            SolrDocsLists.SortBy = 'UNIQUE_ID';
                            SolrDocsLists.SolrDocs = reqInstanceHelper.ArrKeyToUpperCase(respArr, objLogInfo);
                            SolrDocsLists.ArrangedBy = 'ASC';
                            SolrDocsLists.RecordsFrom = RecordsFrom;
                            SolrDocsLists.RecordsTo = (RecordsFrom + VisibleDocCount) - 1;
                            response.columns = [];
                            response.data = SolrDocsLists;
                            reqTranDBInstance.GetTableFromTranDB(pSession, 'languages', {}, objLogInfo, function (result, error) {
                                try {
                                    if (error) {
                                        callback(error);
                                    } else {
                                        var colArr = [];
                                        for (var d = 0; d < result.length; d++) {
                                            var colObj = result[d];
                                            if (colArr.indexOf(colObj) == -1) {
                                                colArr.push(colObj);
                                            }
                                        }
                                        for (var i = 0; i < colArr.length; i++) {
                                            var newcolumn = {};
                                            newcolumn.name = colArr[i].language_code;
                                            newcolumn.displayName = colArr[i].language_description;
                                            newcolumn.enableCellEdit = true;
                                            newcolumn.visible = false;
                                            if (newcolumn.name == 'LD_CODE') {
                                                newcolumn.enableCellEdit = false;
                                                newcolumn.displayName = ' Source language';
                                            }
                                            response.columns.push(newcolumn);
                                        }
                                        newcolumn = {};
                                        newcolumn.name = 'LD_CODE';
                                        newcolumn.displayName = 'ld_code';
                                        newcolumn.enableCellEdit = true;
                                        newcolumn.visible = false;
                                        if (newcolumn.name == 'LD_CODE') {
                                            newcolumn.enableCellEdit = false;
                                            newcolumn.displayName = ' Source language';
                                        }
                                        response.columns.push(newcolumn);
                                        response.columns = new reqLinq(response.columns)
                                            .OrderBy(function (data) {
                                                return data.displayName;
                                            })
                                            .ToArray();
                                        return callback(null, response);
                                    }
                                } catch (error) {
                                    return callback(error);
                                }
                            });
                        }
                    } catch (error) {
                        return callback(error);
                    }
                });
            } catch (error) {
                return callback(error);
            }
        });
    } catch (error) {
        return callback(error);
    }
}

function updateLD(params, pHeaders, objLogInfo, callback) {
    try {
        reqDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function (cltClient) {
            try {
                var data = {};
                var langData = params.LANGUAGEDATA;
                var langDataKeys = Object.keys(langData);
                var lstGrps = [];
                for (var i = 0; i < langDataKeys.length; i++) {
                    var currentKey = langDataKeys[i];
                    // if (!langData[currentKey] && currentKey.toUpperCase() != 'LD_CODE') {
                    //     continue;
                    // }
                    data[currentKey] = langData[currentKey];
                }
                reqTranDBInstance.GetTranDBConn(pHeaders, true, function (pSession) {
                    try {
                        function sendResponse(error, result) {
                            try {
                                if (error) {
                                    reqTranDBInstance.Commit(pSession, false, function () {
                                        callback(error);
                                    });
                                } else {
                                    reqTranDBInstance.Commit(pSession, true, function () {
                                        callback(null, result);
                                    });
                                }
                            } catch (error) {
                                callback(error);
                            }
                        }
                        UpdateDictionary(pSession, pHeaders, params, data, objLogInfo, function (error, result) {
                            try {
                                if (error) {
                                    sendResponse(error);
                                } else {
                                    var languadeCode = '';
                                    var skipCols = ['LD_CODE', 'LDS_GROUP'];
                                    var dataKeys = Object.keys(data);
                                    for (var i = 0; i < dataKeys.length; i++) {
                                        var currKey = dataKeys[i];
                                        if (skipCols.indexOf(currKey.toUpperCase()) == -1) {
                                            languadeCode = currKey;
                                            break;
                                        }
                                    }
                                    if (data.LD_CODE != undefined) {
                                        data.LD_CODE = data.LD_CODE.replace('?', '\\?');
                                    }

                                    var selectQuery = 'select distinct lds.ld_code, lds.client_id,lds.app_id, lds.lds_group, lds.lds_group_key from language_dictionary_source lds left join language_dictionary ld on lds.ld_code = ld.ld_code  where lds.ld_code = \'$ld_code\' and (lds.client_id = \'$client_id\' OR lds.lds_group = \'STATIC WEB\') and (lds.app_id = \'$app_id\' OR lds.lds_group = \'STATIC WEB\')';
                                    selectQuery = selectQuery.replace('$ld_code', (data.LD_CODE ? data.LD_CODE : ''));
                                    selectQuery = selectQuery.replace('$client_id', (params.CLIENT_ID ? params.CLIENT_ID : ''));
                                    selectQuery = selectQuery.replace('$app_id', (params.APP_ID ? params.APP_ID : ''));
                                    reqTranDBInstance.ExecuteSQLQuery(pSession, selectQuery, objLogInfo, function (result, error) {
                                        try {
                                            if (error) {
                                                sendResponse(error);
                                            } else {
                                                var ldsArr = result.rows;
                                                var j = 0;
                                                if (ldsArr.length) {
                                                    doUpdateProcess(ldsArr[j]);
                                                } else {
                                                    sendResponse('No data found');
                                                }
                                                function doUpdateProcess(langRow) {
                                                    try {
                                                        j++;
                                                        if (params.NEED_DELETE && params.NEED_DELETE == 'Y') {
                                                            var k = 0;
                                                            deleteLDS();
                                                            function deleteLDS() {
                                                                try {
                                                                    k++;
                                                                    var objCond = {};
                                                                    objCond.client_id = langRow.client_id;
                                                                    objCond.app_id = langRow.app_id;
                                                                    objCond.ld_code = langRow.ld_code;
                                                                    objCond.lds_group = langRow.lds_group;
                                                                    objCond.lds_group_key = langRow.lds_group_key;
                                                                    reqTranDBInstance.DeleteTranDB(pSession, 'language_dictionary_source', objCond, objLogInfo, function (result, error) {
                                                                        try {
                                                                            if (error) {
                                                                                sendResponse(error);
                                                                            } else {
                                                                                deleteLD();
                                                                            }
                                                                        } catch (error) {
                                                                            sendResponse(error);
                                                                        }
                                                                    });
                                                                } catch (error) {
                                                                    sendResponse(error);
                                                                }
                                                            }
                                                            function deleteLD() {
                                                                try {
                                                                    var objCond = {};
                                                                    objCond.client_id = params.CLIENT_ID;
                                                                    objCond.app_id = params.APP_ID;
                                                                    objCond.ld_code = langRow.ld_code;
                                                                    reqTranDBInstance.DeleteTranDB(pSession, 'language_dictionary', objCond, objLogInfo, function (result, error) {
                                                                        if (error) {
                                                                            sendResponse(error);
                                                                        } else {
                                                                            deleteDone();
                                                                        }
                                                                    });
                                                                } catch (error) {
                                                                    sendResponse(error);
                                                                }
                                                            }
                                                        } else {
                                                            deleteDone();
                                                        }
                                                        function deleteDone() {
                                                            try {
                                                                var ldsCond = {};
                                                                ldsCond.CLIENT_ID = langRow.client_id ? langRow.client_id : '';
                                                                ldsCond.APP_ID = langRow.app_id ? langRow.app_id : '';
                                                                ldsCond.lds_group = langRow.lds_group ? langRow.lds_group : '';
                                                                ldsCond.lds_group_key = langRow.lds_group_key ? langRow.lds_group_key : '';
                                                                reqTranDBInstance.GetTableFromTranDB(pSession, 'language_dictionary_source', ldsCond, objLogInfo, function (result, error) {
                                                                    if (error) {
                                                                        sendResponse(error);
                                                                    } else {
                                                                        var SolrDocs = result;
                                                                        if (!SolrDocs.length) {
                                                                            var ldCond = {};
                                                                            ldCond.CLIENT_ID = params.CLIENT_ID;
                                                                            ldCond.LD_CODE = langRow.ld_code;
                                                                            reqTranDBInstance.GetTableFromTranDB(pSession, 'language_dictionary', ldCond, objLogInfo, function (result, error) {
                                                                                if (error) {
                                                                                    sendResponse(error);
                                                                                } else {
                                                                                    var i = 0;
                                                                                    if (i < result.length) {
                                                                                        insertJson(result[i]);
                                                                                    } else {
                                                                                        var objCond = {};
                                                                                        objCond.language_code = languadeCode ? languadeCode : '';
                                                                                        objCond.group = langRow.lds_group ? langRow.lds_group : '';
                                                                                        objCond.group_key = langRow.lds_group_key ? langRow.lds_group_key : '';
                                                                                        objCond.client_id = langRow.client_id ? langRow.client_id : '0';
                                                                                        reqDBInstance.DeleteFXDB(cltClient, 'language_dictionary_json', objCond, objLogInfo, function (error, result) {
                                                                                            try {
                                                                                                if (error) {
                                                                                                    sendResponse(error);
                                                                                                } else {
                                                                                                    if (j < ldsArr.length) {
                                                                                                        doUpdateProcess(ldsArr[j]);
                                                                                                    } else {
                                                                                                        afterLoopEnd();
                                                                                                    }
                                                                                                }
                                                                                            } catch (error) {
                                                                                                sendResponse(error);
                                                                                            }
                                                                                        });
                                                                                    }
                                                                                    function insertJson(ldRow) {
                                                                                        i++;
                                                                                        var objCond = {};
                                                                                        objCond.language_code = ldRow.language_code ? ldRow.language_code : '';
                                                                                        objCond.group = langRow.lds_group ? langRow.lds_group : '';
                                                                                        objCond.group_key = langRow.lds_group_key ? langRow.lds_group_key : '';
                                                                                        objCond.client_id = langRow.client_id ? langRow.client_id : '0';
                                                                                        reqDBInstance.DeleteFXDB(cltClient, 'language_dictionary_json', objCond, objLogInfo, function (error, result) {
                                                                                            try {
                                                                                                if (error) {
                                                                                                    sendResponse(error);
                                                                                                } else {
                                                                                                    var objRow = {};
                                                                                                    objRow.language_code = ldRow.language_code ? ldRow.language_code : '';
                                                                                                    objRow.group = langRow.lds_group ? langRow.lds_group : '';
                                                                                                    objRow.group_key = langRow.lds_group_key ? langRow.lds_group_key : '';
                                                                                                    objRow.ldj_object = '';
                                                                                                    objRow.client_id = langRow.client_id ? langRow.client_id : '0';
                                                                                                    reqDBInstance.InsertFXDB(cltClient, 'language_dictionary_json', [objRow], objLogInfo, function (error, result) {
                                                                                                        try {
                                                                                                            if (error) {
                                                                                                                sendResponse(error);
                                                                                                            } else {
                                                                                                                if (i < result.length) {
                                                                                                                    insertJson(result[i]);
                                                                                                                } else if (j < ldsArr.length) {
                                                                                                                    doUpdateProcess(ldsArr[j]);
                                                                                                                } else {
                                                                                                                    afterLoopEnd();
                                                                                                                }

                                                                                                            }
                                                                                                        } catch (error) {
                                                                                                            sendResponse(error);
                                                                                                        }
                                                                                                    });
                                                                                                }
                                                                                            } catch (error) {
                                                                                                sendResponse(error);
                                                                                            }
                                                                                        });
                                                                                    }
                                                                                }
                                                                            });
                                                                        } else {
                                                                            for (var i = 0; i < SolrDocs.length; i++) {
                                                                                var sd = SolrDocs[i];
                                                                                var grp = new reqLinq(lstGrps)
                                                                                    .Where(function (tg) {
                                                                                        return tg.Group == sd.lds_group;
                                                                                    }).FirstOrDefault();
                                                                                if (!grp) {
                                                                                    grp = {
                                                                                        Group: sd.lds_group,
                                                                                        Keys: []
                                                                                    };
                                                                                    if (lstGrps.indexOf(grp) == -1) {
                                                                                        lstGrps.push(grp);
                                                                                    }
                                                                                }
                                                                                var Key = new reqLinq(grp.Keys)
                                                                                    .Where(function (tk) {
                                                                                        return tk.Key == sd.lds_group_key;
                                                                                    }).FirstOrDefault();
                                                                                if (!Key) {
                                                                                    Key = {
                                                                                        Key: sd.lds_group_key,
                                                                                        Codes: []
                                                                                    };
                                                                                    if (grp.Keys.indexOf(Key) == -1) {
                                                                                        grp.Keys.push(Key);
                                                                                    }
                                                                                }
                                                                                var Code = new reqLinq(Key.Codes)
                                                                                    .Where(function (tc) {
                                                                                        return tc.Code == sd.ld_code;
                                                                                    }).FirstOrDefault();
                                                                                if (!Code) {
                                                                                    Code = {
                                                                                        Code: sd.ld_code
                                                                                    };
                                                                                    if (Key.Codes.indexOf(Code) == -1) {
                                                                                        Key.Codes.push(Code);
                                                                                    }
                                                                                }
                                                                            }
                                                                            if (j < ldsArr.length) {
                                                                                doUpdateProcess(ldsArr[j]);
                                                                            } else {
                                                                                afterLoopEnd();
                                                                            }
                                                                        }
                                                                    }
                                                                });
                                                            } catch (error) {
                                                                sendResponse(error);
                                                            }
                                                        }
                                                    } catch (error) {
                                                        sendResponse(error);
                                                    }
                                                }
                                                function afterLoopEnd() {
                                                    try {
                                                        var lst = [];
                                                        var i = 0;
                                                        if (lstGrps.length) {
                                                            listGroupLoop(lstGrps[i]);
                                                        } else {
                                                            finalProcess(lst);
                                                        }
                                                        function listGroupLoop(grp) {
                                                            try {
                                                                i++;
                                                                var Keys = grp.Keys;
                                                                var j = 0;
                                                                if (Keys.length) {
                                                                    groupKeysLoop(Keys[j]);
                                                                } else {
                                                                    if (i < lstGrps.length) {
                                                                        listGroupLoop(lstGrps[i]);
                                                                    } else {
                                                                        finalProcess(lst);
                                                                    }
                                                                }
                                                                function groupKeysLoop(key) {
                                                                    try {
                                                                        j++;
                                                                        var Codes = key.Codes;
                                                                        var m = 0;
                                                                        if (Codes.length) {
                                                                            keyCodeLoop(Codes[m]);
                                                                        } else {
                                                                            if (j < Keys.length) {
                                                                                groupKeysLoop(Keys[j]);
                                                                            } else if (i < lstGrps.length) {
                                                                                listGroupLoop(lstGrps[i]);
                                                                            } else {
                                                                                finalProcess(lst);
                                                                            }
                                                                        }
                                                                        function keyCodeLoop(code) {
                                                                            try {
                                                                                m++;
                                                                                var ldCond = {};
                                                                                ldCond.CLIENT_ID = params.CLIENT_ID;
                                                                                ldCond.LD_CODE = code.Code;
                                                                                reqTranDBInstance.GetTableFromTranDB(pSession, 'language_dictionary', ldCond, objLogInfo, function (result, error) {
                                                                                    try {
                                                                                        if (error) {
                                                                                            sendResponse(error);
                                                                                        } else {
                                                                                            var SolrDocs = result;
                                                                                            var k = 0;
                                                                                            if (SolrDocs.length) {
                                                                                                langSolrDocLoop(SolrDocs[k]);
                                                                                            } else {
                                                                                                if (m < Codes.length) {
                                                                                                    keyCodeLoop(Codes[m]);
                                                                                                } else if (j < Keys.length) {
                                                                                                    groupKeysLoop(Keys[j]);
                                                                                                } else if (i < lstGrps.length) {
                                                                                                    listGroupLoop(lstGrps[i]);
                                                                                                } else {
                                                                                                    finalProcess(lst);
                                                                                                }
                                                                                            }
                                                                                            function langSolrDocLoop(sd) {
                                                                                                try {
                                                                                                    k++;
                                                                                                    if (sd.language_code && sd.language_code != 'LD_CODE') {
                                                                                                        var Ldj = new reqLinq(lst)
                                                                                                            .Where(function (tg) {
                                                                                                                return (tg.Language_code == sd.language_code && tg.GROUP == grp.Group && tg.GROUP_KEY == key.Key);
                                                                                                            })
                                                                                                            .FirstOrDefault();
                                                                                                        if (!Ldj) {
                                                                                                            Ldj = {};
                                                                                                            Ldj.GROUP = grp.Group;
                                                                                                            Ldj.GROUP_KEY = key.Key;
                                                                                                            Ldj.Language_code = sd.language_code;
                                                                                                            lst.push(Ldj);
                                                                                                        }
                                                                                                        if (Ldj.LDJ_OBJECT) {
                                                                                                            Ldj.LDJ_OBJECT = Ldj.LDJ_OBJECT + ',\"' + code.Code.trim() + '\":\"' + sd.ld_value.toString().trim() + '\"';
                                                                                                        } else {
                                                                                                            Ldj.LDJ_OBJECT = '\"' + code.Code.trim() + '\":\"' + sd.ld_value.toString().trim() + '\"';
                                                                                                        }
                                                                                                    }
                                                                                                    if (k < SolrDocs.length) {
                                                                                                        langSolrDocLoop(SolrDocs[k]);
                                                                                                    } else if (m < Codes.length) {
                                                                                                        keyCodeLoop(Codes[m]);
                                                                                                    } else if (j < Keys.length) {
                                                                                                        groupKeysLoop(Keys[j]);
                                                                                                    } else if (i < lstGrps.length) {
                                                                                                        listGroupLoop(lstGrps[i]);
                                                                                                    } else {
                                                                                                        finalProcess(lst);
                                                                                                    }
                                                                                                } catch (error) {
                                                                                                    sendResponse(error);
                                                                                                }
                                                                                            }
                                                                                        }
                                                                                    } catch (error) {
                                                                                        sendResponse(error);
                                                                                    }
                                                                                });
                                                                            } catch (error) {
                                                                                sendResponse(error);
                                                                            }
                                                                        }
                                                                    } catch (error) {
                                                                        sendResponse(error);
                                                                    }
                                                                }
                                                            } catch (error) {
                                                                sendResponse(error);
                                                            }
                                                        }
                                                    } catch (error) {
                                                        sendResponse(error);
                                                    }
                                                }
                                                function finalProcess(lst) {
                                                    try {
                                                        if (lst.length) {
                                                            var i = 0;
                                                            doListInsert(lst[i]);
                                                            function doListInsert(Lang) {
                                                                try {
                                                                    i++;
                                                                    if (!Lang.GROUP_KEY) {
                                                                        Lang.GROUP_KEY = '';
                                                                    }
                                                                    var clientid = params.CLIENT_ID;
                                                                    if (Lang.GROUP == 'STATIC WEB' || Lang.GROUP == 'STATIC DESIGNER' || Lang.GROUP == 'STATIC APASS') {
                                                                        clientid = '0';
                                                                    }
                                                                    var objCond = {};
                                                                    objCond.language_code = Lang.Language_code ? Lang.Language_code : '';
                                                                    objCond.group = Lang.GROUP ? Lang.GROUP : '';
                                                                    objCond.group_key = Lang.GROUP_KEY ? Lang.GROUP_KEY : '';
                                                                    objCond.client_id = clientid;
                                                                    reqDBInstance.DeleteFXDB(cltClient, 'language_dictionary_json', objCond, objLogInfo, function (error, result) {
                                                                        try {
                                                                            if (error) {
                                                                                sendResponse(error);
                                                                            } else {
                                                                                var objRow = {};
                                                                                objRow.language_code = Lang.Language_code;
                                                                                objRow.group = Lang.GROUP;
                                                                                objRow.group_key = Lang.GROUP_KEY;
                                                                                objRow.ldj_object = '{' + Lang.LDJ_OBJECT.toString() + '}';
                                                                                objRow.client_id = clientid;
                                                                                reqDBInstance.InsertFXDB(cltClient, 'language_dictionary_json', [objRow], objLogInfo, function (error, result) {
                                                                                    try {
                                                                                        if (error) {
                                                                                            sendResponse(error);
                                                                                        } else {
                                                                                            if (i < lst.length) {
                                                                                                doListInsert(lst[i]);
                                                                                            } else {
                                                                                                sendResponse(null, 'SUCCESS');
                                                                                            }
                                                                                        }
                                                                                    } catch (error) {
                                                                                        sendResponse(error);
                                                                                    }
                                                                                });
                                                                            }
                                                                        } catch (error) {
                                                                            sendResponse(error);
                                                                        }
                                                                    });
                                                                } catch (error) {
                                                                    sendResponse(error);
                                                                }
                                                            }
                                                        } else {
                                                            var ldsObj = ldsArr[0];
                                                            var objCond = {};
                                                            objCond.language_code = languadeCode ? languadeCode : '';
                                                            objCond.group = ldsObj.lds_group ? ldsObj.lds_group : '';
                                                            objCond.group_key = ldsObj.lds_group_key ? ldsObj.lds_group_key : '';
                                                            objCond.client_id = ldsObj.client_id ? ldsObj.client_id : '';
                                                            reqDBInstance.DeleteFXDB(cltClient, 'language_dictionary_json', objCond, objLogInfo, function (error, result) {
                                                                try {
                                                                    if (error) {
                                                                        sendResponse(error);
                                                                    } else {
                                                                        sendResponse(null, 'SUCCESS');
                                                                    }
                                                                } catch (error) {
                                                                    sendResponse(error);
                                                                }
                                                            });
                                                        }
                                                    } catch (error) {
                                                        sendResponse(error);
                                                    }
                                                }
                                            }
                                        } catch (error) {
                                            sendResponse(error);
                                        }
                                    });
                                }
                            } catch (error) {
                                sendResponse(error);
                            }
                        });
                    } catch (error) {
                        callback(error);
                    }
                });
            } catch (error) {
                callback(error);
            }
        });
    } catch (error) {
        callback(error);
    }
}

function UpdateDictionary(pSession, pHeaders, params, pDataRow, objLogInfo, callback) {
    try {
        var strClientId = params.CLIENT_ID ? params.CLIENT_ID : '';
        var strAppId = params.APP_ID ? params.APP_ID : '';
        var strLdCode = pDataRow.LD_CODE ? pDataRow.LD_CODE : '';
        var ldCond = {};
        ldCond.CLIENT_ID = strClientId;
        ldCond.APP_ID = strAppId;
        ldCond.LD_CODE = strLdCode;
        var languageCodes = [];
        var otherCols = ['CLIENT_ID', 'LD_CODE', 'LDS_GROUP', 'LDS_GROUP_KEY', 'LDS_ID', 'LD_ID', 'LD_VALUE', 'APP_ID'];
        var pDataRowKeys = Object.keys(pDataRow);
        for (var l = 0; l < pDataRowKeys.length; l++) {
            var langKey = pDataRowKeys[l];
            if (otherCols.indexOf(langKey) == -1) {
                languageCodes.push(langKey);
            }
        }
        var m = 0;
        if (m < languageCodes.length) {
            languageInsert(languageCodes[m]);
        } else {
            return callback(null, 'SUCCESS');
        }
        function languageInsert(languadeCode) {
            try {
                m++;
                var strLdValue = pDataRow[languadeCode];
                ldCond.language_code = languadeCode ? languadeCode : '';
                reqTranDBInstance.DeleteTranDB(pSession, 'language_dictionary', ldCond, objLogInfo, function (result, error) {
                    try {
                        if (error) {
                            return callback(error);
                        } else {
                            var ldInsertRow = {};
                            ldInsertRow.client_id = strClientId;
                            ldInsertRow.app_id = strAppId;
                            ldInsertRow.ld_code = strLdCode;
                            ldInsertRow.language_code = languadeCode;
                            ldInsertRow.ld_value = strLdValue;
                            ldInsertRow.created_by = params.U_ID;
                            ldInsertRow.version_no = '0';
                            reqTranDBInstance.InsertTranDBWithAudit(pSession, 'language_dictionary', [ldInsertRow], objLogInfo, function (result, error) {
                                try {
                                    if (error) {
                                        return callback(error);
                                    } else {
                                        if (m < languageCodes.length) {
                                            languageInsert(languageCodes[m]);
                                        } else {
                                            return callback(null, 'SUCCESS');
                                        }
                                    }
                                } catch (error) {
                                    return callback(error);
                                }
                            });
                        }
                    } catch (error) {
                        return callback(error);
                    }
                });
            } catch (error) {
                return callback(error);
            }
        }
    } catch (error) {
        return callback(error);
    }
}

function insertStaticlang(params, headers, objLogInfo, callback) {
    try {
        var lng_json = params.LNG_JSON.split(',');
        var lang_data = [];
        for (var i = 0; i < lng_json.length; i++) {
            var strstatic = lng_json[i];
            var lang_static = {
                CLIENT_ID: '0',
                APP_ID: '0',
                LD_CODE: strstatic,
                GROUP: params.GROUP
            };
            lang_data.push(lang_static);
        }
        insertDictionary(params, lang_data, headers, objLogInfo, callback);
    } catch (error) {
        callback(error);
    }
}

function insertDictionary(params, pDataRows, pHeaders, objLogInfo, callback) {
    try {
        reqTranDBInstance.GetTranDBConn(pHeaders, true, function (pSession) {
            try {
                function sendResponse(error, result) {
                    try {
                        if (error) {
                            reqTranDBInstance.Commit(pSession, false, function () {
                                callback(error);
                            });
                        } else {
                            reqTranDBInstance.Commit(pSession, true, function () {
                                callback(null, result);
                            });
                        }
                    } catch (error) {
                        callback(error);
                    }
                }
                var i = 0;
                if (pDataRows.length) {
                    dataRowLoop(pDataRows[i]);
                } else {
                    sendResponse('No dataRow found');
                }
                function dataRowLoop(dataRow) {
                    try {
                        i++;
                        var strClientid = dataRow.CLIENT_ID ? dataRow.CLIENT_ID : '';
                        var strAppId = dataRow.APP_ID ? dataRow.APP_ID : '';
                        var strLdCode = dataRow.LD_CODE ? dataRow.LD_CODE : '';
                        var strGroupname = dataRow.GROUP ? dataRow.GROUP : '';
                        var arrGroupNames = strGroupname.split(',');
                        var g = 0;
                        if (arrGroupNames.length) {
                            groupNameLoop(arrGroupNames[g]);
                        } else {
                            sendResponse('No group name found');
                        }
                        function groupNameLoop(strpart) {
                            try {
                                g++;
                                var strsubparts = strpart.split('~');
                                var group = strsubparts[0] ? strsubparts[0] : '';
                                var groupKey = strsubparts[1] ? strsubparts[1] : '';
                                var ldsCond = {};
                                ldsCond.CLIENT_ID = strClientid;
                                ldsCond.APP_ID = strAppId;
                                ldsCond.LD_CODE = strLdCode;
                                ldsCond.lds_group = group;
                                ldsCond.lds_group_key = groupKey;
                                reqTranDBInstance.GetTableFromTranDB(pSession, 'language_dictionary_source', ldsCond, objLogInfo, function (result, error) {
                                    try {
                                        if (error) {
                                            sendResponse(error);
                                        } else {
                                            if (result.length) {
                                                var existObj = {};
                                                existObj.ld_code = result[0].ld_code;
                                                existObj.group = result[0].lds_group;
                                                existObj.groupKey = result[0].lds_group_key;
                                                existObj.CLIENT_ID = result[0].client_id;
                                                existObj.APP_ID = result[0].app_id;
                                                sendResponse('Text already exist');
                                            } else {
                                                var ldsRow = {};
                                                ldsRow.CLIENT_ID = dataRow.CLIENT_ID ? dataRow.CLIENT_ID : '';
                                                ldsRow.APP_ID = dataRow.APP_ID ? dataRow.APP_ID : '';
                                                ldsRow.LD_CODE = dataRow.LD_CODE ? dataRow.LD_CODE : '';
                                                ldsRow.lds_group = group;
                                                ldsRow.lds_group_key = groupKey;
                                                ldsRow.created_by = params.U_ID;
                                                ldsRow.version_no = '0';
                                                reqTranDBInstance.InsertTranDBWithAudit(pSession, 'language_dictionary_source', [ldsRow], objLogInfo, function (result, error) {
                                                    try {
                                                        if (error) {
                                                            sendResponse(error);
                                                        } else {
                                                            if (g < arrGroupNames.length) {
                                                                groupNameLoop(arrGroupNames[g]);
                                                            } else {
                                                                finalDataRow(null, result);
                                                            }
                                                        }
                                                    } catch (error) {
                                                        sendResponse(error);
                                                    }
                                                });
                                            }
                                        }
                                    } catch (error) {
                                        sendResponse(error);
                                    }
                                });
                            } catch (error) {
                                sendResponse(error);
                            }
                        }
                        function finalDataRow(error, result) {
                            try {
                                if (error) {
                                    sendResponse(error);
                                } else {
                                    if (i < pDataRows.length) {
                                        dataRowLoop(pDataRows[i]);
                                    } else {
                                        sendResponse(null, 'SUCCESS');
                                    }
                                }
                            } catch (error) {
                                sendResponse(error);
                            }
                        }
                    } catch (error) {
                        sendResponse(error);
                    }
                }
            } catch (error) {
                sendResponse(error);
            }
        });
    } catch (error) {
        callback(error);
    }
}

module.exports = {
    LoadLD: loadLD,
    UpdateLD: updateLD,
    LoadLanguageGroupKey: loadLanguageGroupKey,
    InsertStaticlang: insertStaticlang
};