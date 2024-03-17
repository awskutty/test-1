/*
    @Description        : Helper file for ProcessValidation API
    modified for Wfupdate
*/

// Require dependencies
var reqLinq = require('node-linq').LINQ;
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqValidationHelper = require('../../../../../torus-references/validation/ValidationHelper');
var reqAuditLog = require('../../../../../torus-references/log/audit/AuditLog');
var objLogInfo;
var headers;
var strResponse = 'SUCCESS';
var serviceName = 'ValidationHelper';
var mSession;
var strPrctId = '';
//this will call when unexpected close or finish
function finishApiCall() {
    if (mSession) {
        reqTranDBInstance.CallRollback(mSession);
    }
}

function validate(pParams, pHeaders, pObjLogInfo, callback) {
    try {
        var params = pParams;
        headers = pHeaders;
        objLogInfo = pObjLogInfo;
        reqTranDBInstance.GetTranDBConn(headers, false, function (pSession) {
            try {
                mSession = pSession;
                reqDBInstance.GetFXDBConnection(headers, 'dep_cas', objLogInfo, function (pDepCas) {
                    try {
                        reqAuditLog.GetProcessToken(mSession, objLogInfo, function (err, prct_id) {
                            try {
                                if (err) {
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-VAL-120029', 'Error in GetProcessToken function', err);
                                    return callback(prepareErrorData(error, 'Error Code', 'Error in GetProcessToken function'));
                                }
                                objLogInfo.PROCESS_INFO.PRCT_ID = prct_id;
                                strPrctId = prct_id;
                                doTempProcessEntry(mSession, pDepCas, params, function (error, result) {
                                    try {
                                        if (error) {
                                            return callback(prepareErrorData(error.ERROR, error.ERROR_CODE, error.ERROR_MESSAGE));
                                        } else {
                                            var strPrctId = result;
                                            reqInstanceHelper.PrintInfo(serviceName, 'Processing : ' + strPrctId, objLogInfo);
                                            reqDBInstance.GetTableFromFXDB(pDepCas, 'WFTPA_VALIDATIONS', [], { APP_ID: params.APP_ID, EVENT_CODE: params.EVENT_CODE, WFTPA_ID: params.WFTPA_ID }, objLogInfo, function (error, result) {
                                                try {
                                                    if (error) {
                                                        return callback(prepareErrorData(error, 'ERR-VAL-120005', 'Error in validate function'));
                                                    } else {
                                                        reqInstanceHelper.PrintInfo(serviceName, 'inside get vld_json', objLogInfo);
                                                        if (result.rows.length) {
                                                            var vldJson = JSON.parse(result.rows[0].vld_json);
                                                            var validationJson = new reqLinq(vldJson.Validations)
                                                                .OrderBy(function (validation) { return validation.VG_VALIDATIONS.SORT_ORDER; })
                                                                .Select(function (validation) { return validation; })
                                                                .ToArray(); // this is for sort order
                                                            var totalCount = validationJson.length;
                                                            var nextCount = 0;
                                                            params.prct_id = strPrctId;
                                                            doValidate(validationJson[nextCount]);
                                                            function doValidate(currentValidation) {
                                                                try {
                                                                    reqInstanceHelper.PrintInfo(serviceName, 'calling ' + currentValidation.PROGRAM_CODE, objLogInfo);
                                                                    nextCount++;
                                                                    var path = require('path');
                                                                    var fs = require("fs");
                                                                    var appDir = path.dirname(require.main.filename);
                                                                    var validationFilePath = path.join(appDir, 'ide_services', currentValidation.PROJECT_CODE.toLowerCase(), currentValidation.PROGRAM_CODE); // ide_services from currentValidation
                                                                    reqInstanceHelper.PrintInfo(serviceName, 'file path : ' + validationFilePath, objLogInfo);
                                                                    var useLocalFile = fs.existsSync(validationFilePath);
                                                                    var reqValidationFile;
                                                                    if (useLocalFile) {
                                                                        reqValidationFile = require(validationFilePath);
                                                                    } else {
                                                                        validationFilePath = path.join(appDir, '../../../torus-references', 'ide_services', currentValidation.PROJECT_CODE.toLowerCase(), currentValidation.PROGRAM_CODE);
                                                                        reqInstanceHelper.PrintInfo(serviceName, 'file path changed : ' + validationFilePath, objLogInfo);
                                                                        reqValidationFile = require(validationFilePath);
                                                                    }
                                                                    params.headers = headers; // for use in validation file
                                                                    var indexOfDotJs = currentValidation.PROGRAM_CODE.indexOf('.js');
                                                                    if (indexOfDotJs > -1) {
                                                                        currentValidation.PROGRAM_CODE = currentValidation.PROGRAM_CODE.substring(0, indexOfDotJs);
                                                                    }
                                                                    reqValidationFile[currentValidation.PROGRAM_CODE](params, cb);
                                                                    function cb() {
                                                                        try {
                                                                            if (nextCount >= totalCount) {
                                                                                //call wf update here
                                                                                changeStatus(pDepCas, mSession, params, vldJson.Criteria, function (error, result) {
                                                                                    try {
                                                                                        deleteTempProcessEntry(mSession, params);
                                                                                        if (error) {
                                                                                            return callback(prepareErrorData(error.ERROR, error.ERROR_CODE, error.ERROR_MESSAGE));
                                                                                        } else {
                                                                                            return callback(null, result);
                                                                                        }
                                                                                    } catch (error) {
                                                                                        return callback(prepareErrorData(error, 'ERR-VAL-120006', 'Error in validate function'));
                                                                                    }
                                                                                });
                                                                            } else {
                                                                                doValidate(validationJson[nextCount]);
                                                                            }
                                                                        } catch (error) {
                                                                            return callback(prepareErrorData(error, 'ERR-VAL-120007', 'Error in validate function'));
                                                                        }
                                                                    }
                                                                } catch (error) {
                                                                    return callback(prepareErrorData(error, 'ERR-VAL-120008', 'Error in validate function'));
                                                                }
                                                            }
                                                        } else {
                                                            return callback(null, null, 'No Validation found in WFTPA_VALIDATIONS');
                                                        }
                                                    }
                                                } catch (error) {
                                                    return callback(prepareErrorData(error, 'ERR-VAL-120009', 'Error in validate function'));
                                                }
                                            });
                                        }
                                    } catch (error) {
                                        return callback(prepareErrorData(error, 'ERR-VAL-120010', 'Error in validate function'));
                                    }
                                });
                            } catch (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'Error Code', 'Catch Error in GetProcessToken function', error);
                                return callback(prepareErrorData(error, 'Error Code', 'Catch Error in GetProcessToken function'));
                            }
                        });
                    } catch (error) {
                        return callback(prepareErrorData(error, 'ERR-VAL-120011', 'Error in validate function'));
                    }
                });
            } catch (error) {
                return callback(prepareErrorData(error, 'ERR-VAL-120012', 'Error in validate function'));
            }
        });

        function changeStatus(pDepCas, pSession, params, criteria, callback) {
            try {
                reqInstanceHelper.PrintInfo(serviceName, 'inside changeStatus', objLogInfo);
                reqDBInstance.GetTableFromFXDB(pDepCas, 'DT_INFO', ['relation_json'], { APP_ID: params.APP_ID, DT_CODE: params.DT_CODE }, objLogInfo, function (error, result) {
                    try {
                        if (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-VAL-120013', 'Error in validate function', error);
                            return callback(prepareErrorData(error, 'ERR-VAL-120014', 'Error in changeStatus function'));
                        } else {
                            var objDTInfo = result.rows[0];
                            var objDTTRelation = JSON.parse(objDTInfo.relation_json);
                            var objDTT = new reqLinq(objDTTRelation)
                                .Where(function (relation) {
                                    return relation.DTT_CODE == params.DTT_CODE;
                                })
                                .FirstOrDefault();
                            var targetTable = objDTT.TARGET_TABLE;
                            var keyColumn = objDTT.PRIMARY_COLUMN;
                            var totalCount = criteria.length;
                            var nextCount = 0;
                            doChangeStatus(criteria[nextCount]);
                            function doChangeStatus(currentCriteria) {
                                try {
                                    nextCount++;
                                    var status = currentCriteria.STATUS;
                                    var processStatus = currentCriteria.PROCESS_STATUS;
                                    //var condition = currentCriteria.CONDITION;
                                    var rules = currentCriteria.VALIDATION.group.rules;
                                    function checkRules(rules, cb) {
                                        try {
                                            var r = 0;
                                            var cond = {};
                                            if (rules.length) {
                                                checkCurrentRule(rules[r]);
                                            } else {
                                                return cb('FAILURE', cond);
                                            }
                                            function checkCurrentRule(currentRule) {
                                                try {
                                                    r++;
                                                    reqTranDBInstance.GetTableFromTranDB(pSession, 'TRANSACTION_VLD_LOGS', {
                                                        v_code: currentRule.field,
                                                        v_result: currentRule.criteriaOption,
                                                        prct_id: params.prct_id
                                                    }, objLogInfo, function (result, error) {
                                                        try {
                                                            if (error) {
                                                                return callback(prepareErrorData(error, 'ERR-VAL-120031', 'Error in checkRules function'));
                                                            } else {
                                                                if (result.length) {
                                                                    ruleSuccess(result);
                                                                } else {
                                                                    return cb('FAILURE', cond);
                                                                }
                                                            }
                                                        } catch (error) {
                                                            return callback(prepareErrorData(error, 'ERR-VAL-120032', 'Error in checkRules function'));
                                                        }
                                                    });
                                                    function ruleSuccess(result) {
                                                        try {
                                                            var arrTrnIds = [];
                                                            var arrTsIds = [];
                                                            for (var i = 0; i < result.length; i++) {
                                                                var row = result[i];
                                                                if (arrTrnIds.indexOf(row.trn_id) == -1) {
                                                                    arrTrnIds.push(row.trn_id);
                                                                }
                                                                if (arrTsIds.indexOf(row.ts_id) == -1) {
                                                                    arrTsIds.push(row.ts_id);
                                                                }
                                                            }
                                                            cond = { trn_id: arrTrnIds, ts_id: arrTsIds };
                                                            if (r >= rules.length) {
                                                                return cb('SUCCESS', cond);
                                                            } else {
                                                                checkCurrentRule(rules[r]);
                                                            }
                                                        } catch (error) {
                                                            return callback(prepareErrorData(error, 'ERR-VAL-120033', 'Error in checkRules function'));
                                                        }
                                                    }
                                                } catch (error) {
                                                    return callback(prepareErrorData(error, 'ERR-VAL-120034', 'Error in checkRules function'));
                                                }
                                            }
                                        } catch (error) {
                                            return callback(prepareErrorData(error, 'ERR-VAL-120035', 'Error in checkRules function'));
                                        }
                                    }
                                    checkRules(rules, function (result, condition) {
                                        try {
                                            if (result == 'SUCCESS' && condition) {
                                                var updateQuery = "UPDATE " + targetTable + " SET STATUS = '" + status + "', PROCESS_STATUS = '" + processStatus + "' WHERE " + keyColumn + " IN (" + condition.trn_id + ")";
                                                reqTranDBInstance.ExecuteSQLQuery(pSession, updateQuery, objLogInfo, function (result, error) {
                                                    try {
                                                        if (error) {
                                                            return callback(prepareErrorData(error, 'ERR-VAL-120015', 'Error in changeStatus function'));
                                                        } else {
                                                            if (objDTT.CATEGORY != 'M') {
                                                                updateQuery = "UPDATE TRANSACTION_SET SET STATUS = '" + status + "', PROCESS_STATUS = '" + processStatus + "' WHERE TS_ID IN (" + condition.ts_id + ")";
                                                                reqTranDBInstance.ExecuteSQLQuery(pSession, updateQuery, objLogInfo, function (result, error) {
                                                                    try {
                                                                        if (error) {
                                                                            return callback(prepareErrorData(error, 'ERR-VAL-120016', 'Error in changeStatus function'));
                                                                        } else {
                                                                            callWFUpdate(result);
                                                                        }
                                                                    } catch (error) {
                                                                        return callback(prepareErrorData(error, 'ERR-VAL-120017', 'Error in changeStatus function'));
                                                                    }
                                                                });
                                                            } else {
                                                                callWFUpdate(result);
                                                            }
                                                            function callWFUpdate(result) {
                                                                try {
                                                                    console.log(result);
                                                                    if (nextCount >= totalCount) {
                                                                        reqInstanceHelper.PrintInfo(serviceName, 'calling callWFUpdate', objLogInfo);
                                                                        //call fw change status here
                                                                        reqValidationHelper.WFUpdate(pDepCas, pSession, params.APP_ID, params.prct_id, params.U_ID, params.DT_CODE, params.DTT_CODE, params.WFTPA_ID, params.EVENT_CODE, '', objLogInfo, headers, function () {
                                                                            return callback(null, strResponse);
                                                                        });
                                                                    } else {
                                                                        doChangeStatus(criteria[nextCount]);
                                                                    }
                                                                } catch (error) {
                                                                    return callback(prepareErrorData(error, 'ERR-VAL-120018', 'Error in changeStatus function'));
                                                                }
                                                            }
                                                        }
                                                    } catch (error) {
                                                        return callback(prepareErrorData(error, 'ERR-VAL-120019', 'Error in changeStatus function'));
                                                    }
                                                });
                                            } else {
                                                if (nextCount >= totalCount) {
                                                    reqInstanceHelper.PrintInfo(serviceName, 'calling callWFUpdate', objLogInfo);
                                                    //call fw change status here
                                                    reqValidationHelper.WFUpdate(pDepCas, pSession, params.APP_ID, params.prct_id, params.U_ID, params.DT_CODE, params.DTT_CODE, params.WFTPA_ID, params.EVENT_CODE, '', objLogInfo, headers, function () {
                                                        return callback(null, strResponse);
                                                    });
                                                } else {
                                                    doChangeStatus(criteria[nextCount]);
                                                }
                                            }
                                        } catch (error) {
                                            return callback(prepareErrorData(error, 'ERR-VAL-120036', 'Error in changeStatus function'));
                                        }
                                    });
                                } catch (error) {
                                    return callback(prepareErrorData(error, 'ERR-VAL-120020', 'Error in changeStatus function'));
                                }
                            }
                        }
                    } catch (error) {
                        return callback(prepareErrorData(error, 'ERR-VAL-120021', 'Error in changeStatus function'));
                    }
                });
            } catch (error) {
                return callback(prepareErrorData(error, 'ERR-VAL-120022', 'Error in changeStatus function'));
            }
        }

        function deleteTempProcessEntry(pSession, params) {
            try {
                reqTranDBInstance.DeleteTranDB(pSession, 'TMP_PROCESS_ITEMS', { prct_id: params.prct_id }, objLogInfo, function (result, error) {
                    try {
                        if (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-VAL-120028', 'Error in deleteTempProcessEntry function', error);
                        } else {
                            reqInstanceHelper.PrintInfo(serviceName, result, objLogInfo);
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-VAL-120029', 'Error in deleteTempProcessEntry function', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-VAL-120030', 'Error in deleteTempProcessEntry function', error);
            }
        }

        function doTempProcessEntry(pSession, pDepCas, params, callback) {
            try {
                reqInstanceHelper.PrintInfo(serviceName, 'inside doTempProcessEntry', objLogInfo);
                var jsonDataSet = JSON.parse(params.JSON_DATASET);
                if (!jsonDataSet.length) {
                    //wf select case
                    reqValidationHelper.WFSelect(params, pSession, pDepCas, objLogInfo, headers, function (tblResult) {
                        try {
                            if (typeof tblResult.TokenID == 'string') {
                                return callback(null, tblResult.TokenID);
                            } else {
                                return callback(tblResult);
                            }
                        } catch (error) {
                            return callback(prepareErrorData(error, 'ERR-VAL-120023', 'Error in doTempProcessEntry function'));
                        }
                    });
                } else {
                    //selected value case
                    var nextCount = 0;
                    var totalCount = jsonDataSet.length;
                    // var strPrctId = reqUuid.v1();
                    doInsert(jsonDataSet[nextCount]);
                    function doInsert(currentItem) {
                        try {
                            nextCount++;
                            var rows = [];
                            var objRow = {
                                dt_code: currentItem.dt_code,
                                dtt_code: currentItem.dtt_code,
                                item_id: currentItem.trn_id,
                                ts_id: currentItem.ts_id,
                                created_by: currentItem.created_by,
                                created_date: reqDateFormatter.GetTenantCurrentDateTime(headers, objLogInfo),
                                prct_id: strPrctId
                            };
                            rows.push(objRow);
                            reqTranDBInstance.InsertTranDB(pSession, 'TMP_PROCESS_ITEMS', rows, objLogInfo, function (result, error) {
                                try {
                                    if (nextCount >= totalCount) {
                                        return callback(error, strPrctId);
                                    } else {
                                        doInsert(jsonDataSet[nextCount]);
                                    }
                                } catch (error) {
                                    return callback(prepareErrorData(error, 'ERR-VAL-120024', 'Error in doTempProcessEntry function'));
                                }
                            });
                        } catch (error) {
                            return callback(prepareErrorData(error, 'ERR-VAL-120025', 'Error in doTempProcessEntry function'));
                        }
                    }
                }
            } catch (error) {
                return callback(prepareErrorData(error, 'ERR-VAL-120026', 'Error in doTempProcessEntry function'));
            }
        }
    } catch (error) {
        return callback(prepareErrorData(error, 'ERR-VAL-120027', 'Error in validate function'));
    }
}

function prepareErrorData(error, errorCode, errorMessage) {
    var errJson = {
        ERROR: error,
        ERROR_CODE: errorCode,
        ERROR_MESSAGE: errorMessage
    };
    return errJson;
}

module.exports = {
    Validate: validate,
    FinishApiCall: finishApiCall
};
/******** End of File *******/