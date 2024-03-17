
// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var request = require('request');
var async = require('async');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
router.post('/ClearSolrCore', function (appRequest, appResponse) {
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        try {
            var ServiceName = 'ClearsolrCore';
            var ReqHeader = appRequest.headers;
            var solrKey = 'SOLR_LOGGING~' + ReqHeader.routingkey.toUpperCase();
            _PrintInfo(objLogInfo, "ClearsolrCore begin");
            reqDBInstance.GetFXDBConnection(ReqHeader, 'clt_cas', objLogInfo, function (pClient) {
                reqDBInstance.GetTableFromFXDB(pClient, 'TORUS_PLATFORM_SETUP', [], { setup_code: "CLEAR_SOLR_CORE_QUERY" }, objLogInfo, function (perr, pRes) {
                    if (perr) {
                        reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-ARC-50016', 'Error occured geting setupjson from target table', perr, 'FAILURE');
                    } else {
                        var arrSetupJson = JSON.parse(pRes.rows[0].setup_json).solr_query;
                        reqRedisInstance.GetRedisConnection(function (error, clientR) {
                            clientR.get(solrKey, function (err, res) {
                                if (!err && res) {
                                    _PrintInfo(objLogInfo, "Got the solr config");
                                    var configJson = JSON.parse(res);
                                    var solrPort = configJson.PORT;
                                    var solrserver = configJson.SERVER;
                                    var arrRes = [];
                                    async.forEachOfSeries(arrSetupJson, function (setupJson, key, callback) {
                                        var SolrCore = setupJson.core;
                                        var qry = setupJson.query;
                                        var qryurl = `http://${solrserver}:${solrPort}/solr/${SolrCore}/update?stream.body=<delete><query>${qry}</query></delete>&commit=true`;
                                        var options = {
                                            url: qryurl,
                                            method: 'GET',
                                            json: true
                                        };
                                        if (qry) {
                                            request(options, function (error, response, body) {
                                                try {
                                                    if (error) {
                                                        _PrintInfo(objLogInfo, "Error occured wile query solr " + error);
                                                        reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-ARC-5000', 'error occured while executing solr query ' + error, error, '', '');
                                                    } else {
                                                        _PrintInfo(objLogInfo, "Solr clear done for core | " + SolrCore);
                                                        var resobj = {};
                                                        resobj[SolrCore] = body;
                                                        arrRes.push(resobj);
                                                        callback();
                                                    }
                                                } catch (error) {
                                                    reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-MIN-5002', 'ERROR IN Archival send mail api', error, '', '');
                                                }
                                            });
                                        } else {
                                            var resobj = {};
                                            resobj[SolrCore] = 'query not available';
                                            arrRes.push(resobj);
                                            callback();
                                        }
                                    }, function (error) {
                                        if (error) {
                                            reqInstanceHelper.SendResponse(ServiceName, appResponse, arrRes, objLogInfo, 'ERR-ARC-50615', 'Error occured while execute query', error, 'FAILURE');
                                        } else {
                                            _PrintInfo(objLogInfo, "clear solr core done");
                                            reqInstanceHelper.SendResponse(ServiceName, appResponse, arrRes, objLogInfo, '', '', '', '', '');
                                        }
                                    }
                                    );
                                } else if (err) {
                                    _PrintInfo(objLogInfo, "Got error " + err);
                                    reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-ARC-5003', 'Error occured geting solr key from redis ', err, '', '');
                                } else {
                                    _PrintInfo(objLogInfo, "Redis key not available " + solrKey);
                                    reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-ARC-50605', ' Redis Key not found ', solrKey, '', '');
                                }
                            });
                        });
                    }
                });
            });
        } catch (error) {
            reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-ARC-50608', 'Exception occured', error, '', '');
        }

        function _PrintInfo(pLogInfo, pMessage) {
            reqInstanceHelper.PrintInfo(ServiceName, pMessage, pLogInfo);
        }


    });
});
module.exports = router;
