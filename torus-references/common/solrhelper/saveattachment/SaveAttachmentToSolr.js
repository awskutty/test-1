
/**
 * Description :  To save the attachment data from trna and trna_data to solr STATIC CORE
 Core Name changes
 */

// Require dependencies
var reqRequest = require('request');
var reqSolrInstance = require('../../../instance/SolrInstance');
var reqDBInstance = require('../../../instance/DBInstance');
var reqInstanceHelper = require('../../InstanceHelper');
var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];

// Global variable initialization
var mResClient = '';
var SOLR_URL = "";
var relative_path = '';
//var literName = '';
var DT_CODE = '';
var DTT_CODE = '';
var pFilename = '';
var byte_data = '';
var sel_query = '';
var extn = '';
var objLogInfo = null;
var pConsumerName = 'SaveAttachment';

// this is for starting consumer
function StartsaveConsumer(strMsg, pObjLogInfo, callback) {
    try {
        if (pObjLogInfo) {
            objLogInfo = pObjLogInfo;
        }
        if (strMsg) {
            strMsg = reqInstanceHelper.ArrKeyToLowerCase([strMsg])[0];
            reqInstanceHelper.PrintInfo(pConsumerName, 'Inside StartsaveConsumer', objLogInfo);
            var mHeaders = strMsg.headers || {};
            reqDBInstance.GetFXDBConnection(mHeaders, 'res_cas', pObjLogInfo, function CallbackGetCassandraConn(pResClient) {
                mResClient = pResClient;
                onKafkaGotMsg(strMsg, function Callback(result) {
                    reqInstanceHelper.PrintInfo(pConsumerName, 'Destroying The RES_CAS DB Connections', objLogInfo);
                    // Closing The Connection 
                    reqInstanceHelper.DestroyConn(pConsumerName, objLogInfo, function () {
                        return callback(result);
                    });
                });
            });
        } else {
            reqInstanceHelper.PrintInfo(pConsumerName, 'There is No Data For the Process', objLogInfo);
            return callback({});
        }
    } catch (ex) {
        _WriteLoggingError(ex, "Error in WP-OTPConsumer function ");
        return callback({});
    }
}
// this will hit, when consumer got message
function onKafkaGotMsg(json, pCallback) {
    try {
        if (json) {
            var isFromNewAtmtConsumer;
            if (json.isfromnewatmtconsumer) {
                isFromNewAtmtConsumer = json.isfromnewatmtconsumer;
                delete json.isfromnewatmtconsumer;
            }
            SelectFromCasssandra(json, function callback(pStatus, result) {
                try {
                    if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0' && isFromNewAtmtConsumer) {
                        reqInstanceHelper.PrintInfo(pConsumerName, 'Platform Version - ' + serviceModel.PLATFORM_VERSION, objLogInfo);
                        var resultinfo = {};
                        resultinfo.data = result;
                        if (pStatus) {
                            resultinfo.status = 'SUCCESS';
                        } else {
                            resultinfo.status = 'FAILURE';
                        }
                        return pCallback(resultinfo);

                    } else {
                        if (pStatus) {
                            var coreName = '';
                            if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {
                                coreName = 'TRAN_ATMT_CONTENT';
                            } else {
                                coreName = 'STATIC_CORE';
                            }
                            reqInstanceHelper.PrintInfo(pConsumerName, 'Core Name - ' + coreName, objLogInfo);
                            var headers = json.headers || {};
                            reqSolrInstance.GetSolrURL(headers, coreName, function (pSolrClient) {
                                SOLR_URL = pSolrClient;
                                _WriteonSolr(result, json, function (result) {
                                    return pCallback(result);
                                });
                            });
                        }
                    }
                } catch (ex) {
                    _WriteLoggingError(ex.stack, 'Error in WP-onKafkaGotMsg-SelectFromCasssandra function ')
                }
            })
        }
    } catch (ex) {
        _WriteLoggingError(ex.stack, 'Error in WP-onKafkaGotMsg function ')
    }
}

// Query the trna_data table
function SelectFromCasssandra(Pparams, callback) {

    relative_path = Pparams.relative_path ? Pparams.relative_path : '';
    //literName = Pparams.relative_path ? Pparams.relative_path : '';
    DT_CODE = Pparams.dt_code ? Pparams.dt_code : ''; //"DT_PO_TRAN";
    DTT_CODE = Pparams.dtt_code ? Pparams.dtt_code : ''; //"DTT_FX_PO";
    pFilename = Pparams.original_file_name ? Pparams.original_file_name : ''; //"01 Audit Report (01-18-2016).pdf";
    var extInx = relative_path.lastIndexOf(".");
    extn = relative_path.substring(extInx, relative_path.length)
    // if (extn == '.JPG' || extn == '.JPEG' || extn == '.PNG' || extn == '.TIFF' || extn == '.IMG') {
    //     sel_query = sel_trna_img;
    // } else {
    //     sel_query = sel_trna_data
    // }
    reqInstanceHelper.PrintInfo(pConsumerName, 'Query the trna_data table', objLogInfo);
    var columnList = ['byte_data', 'trnad_id', 'relative_path', 'text_data'];
    reqDBInstance.GetTableFromFXDB(mResClient, 'trna_data', columnList, {
        relative_path: relative_path
    }, objLogInfo, function (err, result) {
        if (err) {
            _WriteLoggingError(err.stack, 'Error in WP-GetTableFromFXDB function ')
            callback(false, null);
        } else {
            reqInstanceHelper.PrintInfo(pConsumerName, 'Returned Rows ' + result.rows.length, objLogInfo);
            callback(true, result);
        }
    })
}

// Prepare and write the byte data to solr static core
function _WriteonSolr(result, json, callback) {
    try {
        var row = result.rows[0];
        if (row) {
            var trnad_id = row.trnad_id;
            if (extn == '.JPG' || extn == '.JPEG' || extn == '.PNG' || extn == '.TIFF' || extn == '.IMG') {
                byte_data = new Buffer.from(row.text_data, 'base64')
                byte_data = new Buffer.from(byte_data);
            } else {
                byte_data = new Buffer.from(row.byte_data);
            }
            var newCoreName = '';
            if (global.isLatestPlatformVersion) {
                newCoreName = 'TRAN_ATMT_CONTENT';
            } else {
                newCoreName = 'GSS_STATIC_CORE';
            }
            var postURL = SOLR_URL + '/solr/' + newCoreName + '/update/extract';
            var uid = 0;
            RandomUniqueId(function (pUid) {
                uid = pUid;
            });
            var querystring = {
                commit: true,
                "literal.id": uid,
                "literal.filename": json.relative_path,
                "literal.DT_CODE": json.dt_code,
                "literal.DTT_CODE": json.dtt_code,
                "literal.original_file_name": json.original_file_name,
                "literal.file_type": extn.substring(1),
                "literal.file_size": Buffer.byteLength(byte_data),
                "literal.trna_id": json.trna_id,
                "literal.trn_id": json.trn_id,
                "literal.dttac_desc": json.dttac_desc,
                "literal.source": json.source,
                "literal.source_details": json.source_details,
                "literal.relative_path": json.relative_path,
                "literal.at_code": json.at_code,
                "literal.is_current": json.is_current,
                "literal.annotation_image_name": json.annotation_image_name,
                "literal.comment_text": json.comment_text,
                "literal.total_pages": json.total_pages,
                "literal.atmt_dtt_code": json.atmt_dtt_code,
                "literal.atmt_trn_id": json.atmt_trn_id,
                "literal.atmt_ts_id": json.atmt_ts_id,
                "literal.is_deleted": json.is_deleted,
                "literal.attachment_title": json.attachment_title,
                "literal.at_description": json.at_description,
                "literal.checked_out_by_name": json.checked_out_by_name,
                "literal.system_id": json.system_id,
                "literal.system_name": json.system_name,
                "literal.created_by": json.created_by,
                "literal.created_by_name": json.created_by_name,
                lowernames: false,
                "resource.name": pFilename
                //wt: 'xml'
            };
            reqInstanceHelper.PrintInfo(pConsumerName, 'Query : ' + JSON.stringify(querystring), objLogInfo);
            var options = {
                url: postURL,
                qs: querystring,
                method: "POST",
                keepAlive: true,
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': Buffer.byteLength(byte_data)
                },
                body: byte_data
            };
            if (byte_data) {
                calrequest(options, callback);
            } else {
                return callback('FAILURE');
            }
        } else {
            console.log('There is No Data from Cassandra for this attachment....');
            return callback('FAILURE');
        }

    } catch (ex) {
        _WriteLoggingError(ex.stack)
    }
}

// To send request
function calrequest(options, callback) {

    reqRequest(options, function (error, response, body) {
        if (error) {
            _WriteLoggingError(error, 'Error in calrequest-reqRequest function ')
            return callback('FAILURE');
        } else {
            reqInstanceHelper.PrintInfo(pConsumerName, 'Success Callback', objLogInfo);
            return callback('SUCCESS');
        }
    });
}

// To generate random unique id
function RandomUniqueId(callback) {
    //var rdm = Math.random() * (100 - 0) + 0;;
    var now = new Date();
    var Unikeykey = now.getFullYear().toString() + now.getMonth().toString() + now.getDay().toString() + ((Date.now() * 10000) + 621355968000000000).toString(); // + rdm.toString();
    return callback(Unikeykey);
}

// Log error message
function _WriteLoggingError(error, pMessage) {
    reqInstanceHelper.PrintError(pConsumerName, objLogInfo, error, 'errmsg', pMessage);
}

function _WritelogFile(pFilename, pMessage) {
    try {
        if (reqfs.existsSync(pFilename) == true) {
            reqfs.appendFile(pFilename, pMessage, function (err) {
                assert.ifError(err);
            });
        } else {
            reqfs.writeFile(pFilename, pMessage, function (err) {
                assert.ifError(err);
            });
        }
    } catch (ex) {
        console.log('write log file error ' + ex.stack)
    }
};
module.exports = {
    StartSaveAttachmentConsumer: StartsaveConsumer
};
/********* End of File *************/