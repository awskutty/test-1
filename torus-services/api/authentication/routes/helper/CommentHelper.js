/*
 * @Description: This is helper file for localization api
 * @Last_Error_code:ERR-AUT-110999
 */
var serviceName = 'CommentHelper';
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];

function saveComment(params, headers, objLogInfo, callback) {
    try {
        var isNew = params.IS_NEW;
        var data = params.DATA;
        var by = params.USER_NAME;
        var appId = params.APP_ID;




        reqDBInstance.GetFXDBConnection(headers, 'clt_cas', objLogInfo, function (cltClient) {
            try {
                if (isNew && isNew == 'Y') {
                    insertData();
                } else {
                    updateData();
                }
                function insertData() {
                    try {
                        data.stpc_id = '';
                        data.app_id = appId;
                        data.created_by = by;
                        data.created_date = reqDateFormatter.GetTenantCurrentDateTime(headers, objLogInfo);
                        var columns = Object.keys(data);
                        var dataTypes = [];
                        for (var i = 0; i < columns.length; i++) {
                            var col = columns[i];
                            if (col.toLowerCase() == 'stpc_id') {
                                dataTypes.push('UUID');
                            } else {
                                dataTypes.push('string');
                            }
                        }

                        // Required  (Tenant ID) to be saved if version 7.0
                        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                            data.tenant_id = objLogInfo.TENANT_ID;
                            dataTypes.push('string');
                        }

                        reqDBInstance.InsertFXDB(cltClient, 'stp_comments', [data], objLogInfo, function (error, result) {
                            try {
                                if (error) {
                                    return callback(error);
                                } else {
                                    return callback(null, 'SUCCESS');
                                }
                            } catch (error) {

                            }
                        }, dataTypes);
                    } catch (error) {

                    }
                }
                function updateData() {
                    try {
                        data.modified_by = by;
                        data.modified_date = reqDateFormatter.GetTenantCurrentDateTime(headers, objLogInfo);
                        var cond = {
                            app_id: appId,
                            stpc_id: data.stpc_id
                        };
                        delete data.app_id;
                        delete data.stpc_id;
                        delete data.created_date;
                        delete data.created_by;
                        reqDBInstance.UpdateFXDB(cltClient, 'stp_comments', data, cond, objLogInfo, function (error, result) {
                            try {
                                if (error) {
                                    return callback(error);
                                } else {
                                    return callback(null, 'SUCCESS');
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
        });
    } catch (error) {
        return callback(error);
    }
}

function loadComments(params, headers, objLogInfo, callback) {
    try {
        var appId = params.APP_ID;
        // Required  (Tenant ID) filter if version 7.0
        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
            params.tenant_id = objLogInfo.TENANT_ID;
        }
        reqDBInstance.GetFXDBConnection(headers, 'clt_cas', objLogInfo, function (cltClient) {
            try {
                var cond = {};
                cond.app_id = appId;
                if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                    cond.tenant_id = objLogInfo.TENANT_ID;
                }
                reqDBInstance.GetTableFromFXDBNoCache(cltClient, 'stp_comments', [], cond, objLogInfo, function (error, result) {
                    if (error) {
                        return callback(error);
                    } else {
                        return callback(null, result.rows);
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

function deleteComment(params, headers, objLogInfo, callback) {
    try {
        var data = params.DATA;
        var stpcId = data.stpc_id;
        var appId = params.APP_ID;
        reqDBInstance.GetFXDBConnection(headers, 'clt_cas', objLogInfo, function (cltClient) {
            try {
                var cond = {};
                cond.app_id = appId;
                cond.stpc_id = stpcId;
                reqDBInstance.DeleteFXDB(cltClient, 'stp_comments', cond, objLogInfo, function (error, result) {
                    if (error) {
                        return callback(error);
                    } else {
                        return callback(null, 'SUCCESS');
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

module.exports = {
    SaveComment: saveComment,
    LoadComments: loadComments,
    DeleteComment: deleteComment
};