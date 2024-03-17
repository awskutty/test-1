try {
    /*
  @Decsription      : To process cassandra related functions,
  @Last Error Code  : 'ERR-REF-230071'
  @Last_Modify_Change : Csrf Token Validation
*/

    // Require dependencies
    //var config = require('../../config/config.json');
    var reqInstanceHelper = require('../common/InstanceHelper');
    var reqRedisInstance = require('./RedisInstance');
    var reqCassandraInstance = require('./CassandraInstance');
    var reqTranDBInstance = require('./TranDBInstance');
    var reqDBInstance = require('./DBInstance');
    var reqKafkaInstance = require('./KafkaInstance');
    var reqSolrInstance = require('./SolrInstance');
    var reqCacheRedisInstance = require('./CacheRedisInstance');
    var reqEncryptionInstance = require('../common/crypto/EncryptionInstance');
    var reqAnalyticInstance = require('./AnalyticInstance');
    var reqIMAPMailReceiver = require('../communication/core/mail/IMAPMailReceiver');
    var helmet = require('helmet');
    var reqMoment = require('moment');
    var xss = require('xss');

    // Global variable declaration
    var defaultkey = "clt-0~app-0~tnt-0~env-0";
    global.physicalLogInfo = [];
    var arrRedisKeys = [];
    var currentKeyCount = 0;
    var serviceName = 'AppHelper';
    var serviceInstance = {};
    var objLogInfo = {};
    var mServer = {};

    //to bypass https
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

    // Do create instance process with next redis key
    function doNextCall(callback) {
        try {
            if (currentKeyCount < arrRedisKeys.length) {
                createInstance(arrRedisKeys[currentKeyCount], callback);
            } else {
                return callback('SUCCESS');
            }
        } catch (error) {
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230004', 'Error in doNextCall function', error);
        }
    }

    // Create corresponding instance by redis key
    function createInstance(currentKey, callback) {
        try {
            var reqDBInstance = require('./DBInstance');
            var reqReportInstance = require('./ReportInstance');
            currentKeyCount++;
            var connStr = currentKey.split('~', currentKey.length)[0];
            var serviceModel;
            var loadThisKeyFlag = false;
            if (connStr != 'SERVICE_MODEL') {
                serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
                if (serviceModel) {
                    if (serviceInstance[serviceModel.TYPE].indexOf('$DB_TYPE') > -1) {
                        var posOfDBType = serviceInstance[serviceModel.TYPE].indexOf('$DB_TYPE');
                        serviceInstance[serviceModel.TYPE][posOfDBType] = serviceModel.TRANDB ? serviceModel.TRANDB : 'POSTGRES';
                    }
                    loadThisKeyFlag = serviceInstance[serviceModel.TYPE].indexOf(connStr) > -1;
                } else {
                    loadThisKeyFlag = true;
                }
            } else {
                loadThisKeyFlag = true;
            }
            if (serviceInstance && loadThisKeyFlag) {
                function cb(pResult) {
                    try {
                        if (pResult.status == 'SUCCESS') {
                            reqInstanceHelper.PrintInfo(serviceName, 'SUCCESS', null);
                            doNextCall(callback);
                        } else {
                            reqInstanceHelper.PrintInfo(serviceName, 'FAILURE', null);
                            doNextCall(callback);
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230005', 'Error in cb function', error);
                    }
                }
                reqInstanceHelper.GetConfig(currentKey, function (pConf) {
                    try {
                        var objResult = JSON.parse(pConf);
                        switch (connStr) {
                            case 'SERVICE_MODEL':
                                reqInstanceHelper.PrintInfo(serviceName, 'Getting instance for : ' + currentKey, null);
                                reqDBInstance.LoadServiceModel(currentKey, objResult, cb);
                                break;
                            case 'CASSANDRA':
                                reqCassandraInstance.CreateCassandraInstance(currentKey, objResult, cb);
                                break;
                            case 'POSTGRES':
                            case 'MYSQL':
                            case 'ORACLE':
                                if (serviceModel) {
                                    reqTranDBInstance.LoadFxDBClient(serviceModel);
                                }
                                reqDBInstance.CreateFxDBInstance('knex', currentKey, objResult, cb);
                                break;
                            case 'TRANDB':
                                reqInstanceHelper.PrintInfo(serviceName, 'Getting DB_TYPE from : ' + currentKey, null);
                                var reqDateFormatter = require('../common/dateconverter/DateFormatter');
                                reqDateFormatter.LoadAppDbType(currentKey, objResult, cb);
                                break;
                            case 'SOLR_LOGGING':
                                reqSolrInstance.CreateSolrInstance(currentKey, objResult, cb);
                                break;
                            case 'SOLR_SEARCH':
                                reqSolrInstance.CreateSolrInstance(currentKey, objResult, function (pResult) {
                                    try {
                                        if (pResult.status == 'SUCCESS') {
                                            reqSolrInstance.CreateSolrURL(currentKey, objResult, cb);
                                        } else {
                                            reqInstanceHelper.PrintInfo(serviceName, 'FAILURE', null);
                                            doNextCall(callback);
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230017', 'Error in reqSolrInstance.CreateSolrInstance callback', error);
                                    }
                                });
                                break;
                            case 'SOLR_LANGUAGE':
                                reqSolrInstance.CreateSolrInstance(currentKey, objResult, cb);
                                break;
                            case 'SERVICE_PARAMS':
                                reqInstanceHelper.GetRedisServiceParamConfig();
                                break;
                            case 'KAFKA_CONFIG':
                                reqKafkaInstance.CreateKafkaInstance(currentKey, objResult, cb);
                                break;
                            case 'JASPER_SERVER':
                                reqReportInstance.SetReportConfig(currentKey, objResult, cb);
                                break;
                            case 'CACHE_DB':
                                reqInstanceHelper.PrintInfo(serviceName, 'Getting instance for : ' + currentKey, null);
                                reqCacheRedisInstance.CreateRedisInstance(currentKey, objResult, cb);
                                break;
                            default:
                                doNextCall(callback);
                                break;
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230006', 'Error in reqInstanceHelper.GetConfig callback', error);
                    }
                });
            } else {
                doNextCall(callback);
            }
        } catch (error) {
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230007', 'Error in createInstance function', error);
        }
    }

    // Get redis value by key
    function getRedisValue(pKeyName, pHeaders, pCallback) { // verify where is this function used
        //serviceName = 'AppHelper.js getRedisValue()';
        try {
            var redisKey = pKeyName + '~' + (pHeaders['routingkey'] ? pHeaders['routingkey'].toUpperCase() : "");
            var redisKeyDefault = pKeyName + '~' + defaultkey.toUpperCase();
            clientRedis.exists(redisKey, function (err, reply) {
                try {
                    if (reply === 1) {
                        clientRedis.get(redisKey, function (err, reply) {
                            try {
                                pCallback(reply.toString(), err);
                            } catch (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230008', 'Error in getRedisValue function', error);
                            }
                        });
                    } else {
                        clientRedis.exists(redisKeyDefault, function (err, replydefault) {
                            try {
                                if (replydefault === 1) {
                                    clientRedis.get(redisKeyDefault, function (err, reply) {
                                        try {
                                            pCallback(reply.toString(), err);
                                        } catch (error) {
                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230009', 'Error in getRedisValue function', error);
                                        }
                                    });
                                } else {
                                    pCallback(null, null);
                                }
                            } catch (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230010', 'Error in getRedisValue function', error);
                            }
                        });
                    }
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230011', 'Error in getRedisValue function', error);
                }
            });
        } catch (error) {
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230012', 'Error in getRedisValue function', error);
        }
    }

    // Read SERVICE_MODEL key as first
    function makeServiceModelKeyToFirst() {
        try {
            var serviceModelPos = arrRedisKeys.indexOf('SERVICE_MODEL');
            if (serviceModelPos > 0) {
                var firstElmt = arrRedisKeys[0];
                var serviceModelPos = arrRedisKeys.indexOf('SERVICE_MODEL');
                var serviceModel = arrRedisKeys[serviceModelPos];
                arrRedisKeys[0] = serviceModel;
                arrRedisKeys[serviceModelPos] = firstElmt;
            }
        } catch (error) {
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230019', 'Error in makeServiceModelKeyToFirst function', error);
        }
    }

    function filterDefaultKeys() {
        try {
            var filteredArr = [];
            for (var i = 0; i < arrRedisKeys.length; i++) {
                var currentKey = arrRedisKeys[i].toUpperCase();
                if (currentKey.indexOf('SERVICE_PARAMS') > -1 || currentKey.indexOf('SERVICE_MODEL') > -1 || currentKey.indexOf('JASPER_SERVER') > -1 || currentKey.indexOf('TRANDB') > -1 || currentKey.indexOf('CACHE_DB') > -1) { // || currentKey.indexOf(defaultkey.toUpperCase()) > -1) {
                    filteredArr.push(currentKey);
                }
                // if (i % 100 === 0) {
                //     console.log('clearing stack...');
                //     setTimeout(function () {

                //     }, 0);
                // }
            }
            arrRedisKeys = filteredArr;
        } catch (error) {
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230020', 'Error in filterDefaultKeys function', error);
        }
    }

    // Load all instances on service init
    function loadAllInstanses(pServiceName, callback) {
        try {
            var reqServiceInstances = require('../../config/ServiceInstances');
            global.DisconnInProgress = false;
            function doCreateInstances(isInitial) {
                try {
                    reqInstanceHelper.PrintInfo(pServiceName, 'Instances loading...', null);
                    reqInstanceHelper.GetAllRedisKeys(function (keys) {
                        try {
                            arrRedisKeys = keys;
                            if (pServiceName != 'TranDataProducer' && pServiceName != 'WP-OTPConsumer' && pServiceName != 'SaveTranConsumer' && pServiceName != 'SaveAttachmentConsumer' && pServiceName != 'LogConsumer' && pServiceName != 'EmailScan' && pServiceName != 'AuditLogConsumer' && pServiceName != 'AtmtDataProducer' && pServiceName != 'APCP-OTPConsumer') {
                                filterDefaultKeys();
                            }
                            makeServiceModelKeyToFirst();
                            currentKeyCount = 0;
                            if (arrRedisKeys.length) {
                                if (isInitial) {
                                    createInstance(arrRedisKeys[currentKeyCount], callback);
                                } else {
                                    createInstance(arrRedisKeys[currentKeyCount], function () {
                                        try {
                                            reqInstanceHelper.PrintInfo(pServiceName, 'Instances loaded successfully.', null);
                                        } catch (error) {
                                            reqInstanceHelper.PrintError(pServiceName, objLogInfo, 'ERR-REF-230021', 'Error in createInstance callback', error);
                                        }
                                    });
                                }
                            } else {
                                reqInstanceHelper.PrintInfo(pServiceName, 'No Redis Key Available.', null);
                                return callback('SUCCESS');
                            }
                        } catch (error) {
                            reqInstanceHelper.PrintError(pServiceName, objLogInfo, 'ERR-REF-230022', 'Error in getAllRedisKeys callback', error);
                        }
                    });
                } catch (error) {
                    reqInstanceHelper.PrintError(pServiceName, objLogInfo, 'ERR-REF-230023', 'Error in doCreateInstances function', error);
                }
            }
            serviceInstance = reqServiceInstances[pServiceName];
            if (!serviceInstance) {
                return reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230070', 'There is No Service Instance Config for ' + pServiceName + ' Service...', '');
            }
            doCreateInstances(true);
        } catch (error) {
            reqInstanceHelper.PrintError(pServiceName, objLogInfo, 'ERR-REF-230024', 'Error in loadAllInstanses function', error);
        }
    }

    // Start service from app.js
    function startService(pServiceName, pRoutes, pServiceLocation) {
        var path = require('path');
        reqInstanceHelper.PrintInfo(serviceName, pServiceName + ' service starting...', null);
        var reqlogwritetofile = require('../log/trace/SolrLogHelper');
        reqlogwritetofile.filelogwrite();
        global.physicalLogInfo = [];
        var service = '';

        if (process.title.indexOf('Torus_Svc_') > -1) {
            service = process.title.split('Torus_Svc_')[1].toLowerCase();
        }
        if (service) {
            global.serviceLogPath = path.join(__dirname, '../../' + 'torus-services/api/' + service + '/logs/');
        }
        console.log(global.serviceLogPath, '==============');


        var path = require('path');
        var logger = require('morgan');
        var cookieParser = require('cookie-parser');
        var bodyParser = require('body-parser');
        // var busboyBodyParser = require('busboy-body-parser');
        var express = require('express');
        var reqJWT = require('jsonwebtoken');
        var reqLINQ = require('node-linq').LINQ;
        var app = express();
        var multer = require('multer');
        var upload = multer();
        var reqDBInstance = require('./DBInstance');
        // view engine setup
        app.set('views', path.join(pServiceLocation, 'views'));
        app.set('view engine', 'jade');
        app.use(logger('dev'));
        app.use(upload.any());
        app.use(bodyParser.json({
            limit: '50mb'
        }));
        app.use(bodyParser.urlencoded({
            limit: '50mb',
            extended: false
        }));
        app.use(cookieParser());
        if (process.title == "Torus_Svc_DevopsService") {
            app.use('/dbrms', express.static(path.join(pServiceLocation, 'dbrms')));
        } else {
            app.use(express.static(path.join(pServiceLocation, 'public')));
        }
        app.use(helmet.hidePoweredBy({
            setTo: 'deny'
        }));

        app.use(helmet.noSniff());
        // app.use(helmet.noCache());
        function privateDecryption(req, res, next) {
            try {

                /*
                 @ SERVICE_MODEL key get from redis for every api call
                 @ Changes for Devops service            
                */
                reqInstanceHelper.GetConfig('SERVICE_MODEL', function (ResSvcModel) {
                    if (!ResSvcModel) {
                        reqInstanceHelper.PrintInfo('SERVICE_MODEL', 'SERVICE_MODEL key not available. Set Harcoded value.', objLogInfo);
                        var serviceModel = {};
                        serviceModel.NEED_JWT = 'N';
                        // serviceModel.TRANDB = 'POSTGRES';
                        reqDBInstance.LoadServiceModel('SERVICE_MODEL', serviceModel, function (res) {
                            continuedecrypt(reqDBInstance.DBInstanceSession['SERVICE_MODEL']);
                        });
                    } else {
                        serviceModel = JSON.parse(ResSvcModel);
                        reqDBInstance.LoadServiceModel('SERVICE_MODEL', serviceModel, function (res) {
                            continuedecrypt(serviceModel);
                        });
                    }
                });



                function continuedecrypt(serviceModel) {
                    //serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
                    reqInstanceHelper.PrintInfo('Service call', getSeriveName(req), objLogInfo);
                    reqInstanceHelper.PrintInfo('JWT', serviceModel.NEED_JWT, objLogInfo);
                    var ReqRoutingKey = req.headers['routingkey'];
                    var token = req.headers['session-id'];
                    if ((serviceModel.NEED_JWT != undefined && serviceModel.NEED_JWT == "Y") || (req.url.split("/")[1].toUpperCase() != 'DEVOPSSERVICE' && req.url.split("/")[1].toUpperCase() != 'DBRMS')) {
                        var SkipServices = [];
                        //Need to skip before jwt creation services and cp authentication services
                        reqInstanceHelper.GetConfig('JWT_SKIP_SERVICES', function (services) {
                            var services = JSON.parse(services).SKIP;
                            SkipServices = new reqLINQ(services.SERVICES)
                                .Where(function (item) {
                                    return item.toUpperCase() === getSeriveName(req);
                                }).ToArray();
                            if (SkipServices.length == 0) {
                                CheckRedisSession(token);
                            } else {
                                decryptpayload();
                            }
                        });
                    } else {
                        decryptpayload();
                    }


                    function getSeriveName(reqUrl) {
                        try {
                            if (reqUrl.method.toLowerCase() == "post") {
                                return reqUrl.url.split('/')[2].toUpperCase();
                            } else {
                                return reqUrl.url.split("?")[0].split('/')[2].toUpperCase();
                            }
                        } catch (error) {

                        }


                    }
                    function jwtverification(SkipServices, secretKey, token) {
                        try {
                            // No need to verify jwt token for ULTIMATE Model
                            // if (SkipServices.length == 0 && serviceModel.TYPE != "ULTIMATE" && serviceModel.NEED_JWT != undefined && serviceModel.NEED_JWT == "Y") {
                            if (SkipServices.length == 0) {
                                reqInstanceHelper.PrintInfo('JWT', 'Validating jwt token...', objLogInfo);
                                //Token verification
                                reqJWT.verify(token, secretKey, function (err, tokenres) {
                                    if (err) {
                                        console.log(err);
                                        var response = {};
                                        response.data = err.message;
                                        response.process_status = "FAILURE";
                                        response.service_status = "FAILURE";
                                        response.error_code = "401";
                                        res.send(response);
                                    } else {
                                        reqInstanceHelper.PrintInfo('JWT', 'JWT token validation success', objLogInfo);
                                        // CheckRedisSession(token)
                                        decryptpayload();

                                    }
                                });
                            } else if (SkipServices.length == 0) {
                                CheckRedisSession(token);
                            } else {
                                decryptpayload();
                            }
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230065', 'Error in jwtverification ', error);
                        }
                    }

                    //Check with redis if session available or not
                    function CheckRedisSession(token) {
                        try {
                            var redisKey = "SESSIONID-" + token;
                            reqInstanceHelper.GetConfig(redisKey, function (redisvalue) {
                                if (redisvalue != 0) {
                                    var parsedvalue = JSON.parse(redisvalue);
                                    reqInstanceHelper.GetConfig('API_ACCESS_PRIVILEGES', async function (AccessPrivilegs) {
                                        if (parsedvalue.length == 2 && req.headers.from_scheduler != 'true' && req.method == 'POST') {
                                            var ModuleavailableRes = await ModuleavailablityValidation();
                                            if (ModuleavailableRes == 'SUCCESS') {
                                                var accesPrevlValidationRes = await apiAccessPrivilegValidation(AccessPrivilegs);
                                                if (accesPrevlValidationRes !== "SUCCESS") {
                                                    reqInstanceHelper.PrintInfo(serviceName, '---- Unauthorized api access  ----', null);
                                                    return sendresponse('Unauthorized access');
                                                }
                                                if (req.headers['csrftoken'] && parsedvalue[1].token) {
                                                    if (parsedvalue[1].token !== req.headers['csrftoken']) {
                                                        reqInstanceHelper.PrintInfo(serviceName, '---- Invalid token  ----', null);
                                                        return sendresponse('Invalid token');
                                                    }
                                                }
                                            } else {
                                                reqInstanceHelper.PrintInfo(serviceName, '---- Unauthorized module access  ----', null);
                                                return sendresponse('Unauthorized access');
                                            }
                                        }
                                        var scecretKey = '';
                                        var RSessionRouting = '';
                                        serviceModel.NEED_SYSTEM_ROUTING = 'N';
                                        var parsedjson = '';
                                        if (parsedvalue.length > 0) {
                                            parsedjson = JSON.parse(redisvalue);
                                            scecretKey = parsedjson[0].JWT_SECRET_KEY;
                                            RSessionRouting = parsedjson[0].ROUTINGKEY;
                                            serviceModel.NEED_SYSTEM_ROUTING = parsedjson[0].NEED_SYSTEM_ROUTING;
                                        } else {
                                            var parsedjson = JSON.parse(redisvalue);
                                            scecretKey = parsedjson.JWT_SECRET_KEY;
                                            RSessionRouting = parsedjson.ROUTINGKEY;
                                            serviceModel.NEED_SYSTEM_ROUTING = parsedjson.NEED_SYSTEM_ROUTING;
                                        }
                                        reqInstanceHelper.PrintInfo(serviceName, 'System Routing setup - ' + serviceModel.NEED_SYSTEM_ROUTING, null);
                                        if (serviceModel.NEED_SYSTEM_ROUTING == 'Y') {
                                            serviceModel.PARENT_SYS_ID_ROUTING = parsedjson[1].RoutingSId;
                                            reqInstanceHelper.PrintInfo(serviceName, 'ReqRoutingKey ' + ReqRoutingKey, objLogInfo);
                                            reqInstanceHelper.PrintInfo(serviceName, 'RSessionRouting ' + RSessionRouting, objLogInfo);
                                            if (ReqRoutingKey == RSessionRouting) {
                                                reqInstanceHelper.PrintInfo(serviceName, 'Routing key matched  ----', null);
                                                if (serviceModel.NEED_JWT && serviceModel.NEED_JWT == 'Y') {
                                                    reqInstanceHelper.PrintInfo(serviceName, 'Going validate jwt  ----', null);
                                                    jwtverification(SkipServices, scecretKey, token);
                                                } else {
                                                    decryptpayload();
                                                }
                                            } else {
                                                reqInstanceHelper.PrintInfo(serviceName, '----  Routing key not matched  ----', null);
                                                sendresponse('Routing key not matched');
                                            }
                                        } else {
                                            if (serviceModel.NEED_JWT && serviceModel.NEED_JWT == 'Y') {
                                                jwtverification(SkipServices, scecretKey, token);
                                            } else {
                                                decryptpayload();
                                            }
                                        }
                                    });
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, '---- Session not avilable  ----', null);
                                    return sendresponse('Session Not found');
                                }

                                function ModuleavailablityValidation() {
                                    return new Promise(async (resolve, reject) => {
                                        try {
                                            var reqModuleInfo = req.body.PROCESS_INFO;
                                            if (!reqModuleInfo) {
                                                reqInstanceHelper.PrintInfo(serviceName, '---- Process info not available  ----', null);
                                                return resolve("FAILURE")
                                            } else {
                                                if (parsedvalue[1].MODULEINFO && reqModuleInfo.MODULE != 'Administration') {
                                                    var ModulesAssigedtoUser = parsedvalue[1].MODULEINFO.MODULES;
                                                    if (reqModuleInfo.MODULE && reqModuleInfo.MENU_GROUP && reqModuleInfo.MENU_ITEM) {
                                                        var filteredModule = ModulesAssigedtoUser.filter((mdata) => { return mdata.UIM_DESCRIPTION == reqModuleInfo.MODULE })
                                                        if (filteredModule.length) {
                                                            var filteredMenuGrp = filteredModule[0].MENUGROUPS.filter((mgdata) => { return mgdata.UIMG_DESCRIPTION == reqModuleInfo.MENU_GROUP })
                                                            if (filteredMenuGrp.length) {
                                                                var filteredMenuitem = filteredMenuGrp[0].MENUITEMS.filter((midata) => { return midata.UIMI_SCREEN_NAME == reqModuleInfo.MENU_ITEM || midata.UIMI_DESCRIPTION == reqModuleInfo.MENU_ITEM });
                                                                if (filteredMenuitem.length) {
                                                                    return resolve("SUCCESS");
                                                                } else {
                                                                    return resolve("FAILURE")
                                                                }
                                                            } else {
                                                                return resolve("FAILURE")
                                                            }
                                                        } else {
                                                            return resolve("SUCCESS");
                                                        }
                                                    } else {
                                                        return resolve("SUCCESS");
                                                    }
                                                } else if (parsedvalue[1].STATIC_MODULE && reqModuleInfo.MODULE == 'Administration') {
                                                    var filteredStaticMG = parsedvalue[1].STATIC_MODULE.filter((staticMGData) => { return staticMGData.MENU_GROUP == reqModuleInfo.MENU_GROUP && staticMGData.DESC == reqModuleInfo.MENU_ITEM });
                                                    if (filteredStaticMG.length) {
                                                        resolve('SUCCESS')
                                                    } else {
                                                        resolve('FAILURE')
                                                    }
                                                } else {
                                                    return resolve("SUCCESS");
                                                }
                                            }
                                        } catch (error) {
                                            console.log(error)
                                        }
                                    })
                                }
                                function apiAccessPrivilegValidation(pApiAccessData) {
                                    return new Promise((resolve, reject) => {
                                        try {
                                            reqInstanceHelper.PrintInfo(serviceName, '---- Check access privileges  ----', null);
                                            if (pApiAccessData) {
                                                var parsedApiPreveliegs = JSON.parse(pApiAccessData);
                                                var curApi = getSeriveName(req);
                                                var curRole = parsedvalue[1].APP_USER_ROLES;
                                                var reqProcessInfo = req.body.PROCESS_INFO;
                                                if (curApi && curRole) {
                                                    var isMatched = false;
                                                    var apiMatched = parsedApiPreveliegs.filter((apis) => { return apis.API.toUpperCase() == curApi })
                                                    if (apiMatched.length) {
                                                        reqInstanceHelper.PrintInfo(serviceName, '---- API entry available.Need to validate module menu group  menu item and role ----', null);
                                                        for (var i = 0; i < apiMatched.length; i++) {
                                                            var loopingPreveliegs = apiMatched[i]
                                                            var arrCurModules = loopingPreveliegs.MODULES;
                                                            var curModule = arrCurModules.filter((objmod) => { return reqProcessInfo.MODULE == objmod.MODULE });
                                                            if (curModule.length) {
                                                                for (var j = 0; j < curModule.length; j++) {
                                                                    var modloop = curModule[j];
                                                                    if (reqProcessInfo.MODULE == modloop.MODULE && reqProcessInfo.MENU_GROUP == modloop.MENU_GROUP && reqProcessInfo.MENU_ITEM == modloop.MENU_ITEM && reqProcessInfo.PROCESS_NAME == modloop.PROCESS_NAME) {
                                                                        if (modloop.APPR_ID.indexOf(curRole) > -1) {
                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Access privileges validation passed.', null);
                                                                            isMatched = true;
                                                                            break;
                                                                        }
                                                                    }
                                                                }
                                                            } else {
                                                                // for not to disturb the flow when entry is not available in redis (API_ACCESS_PRIVILEGES)
                                                                reqInstanceHelper.PrintInfo(serviceName, '----Module entry NOT availble for ' + reqProcessInfo.MODULE + ' in redis', null);
                                                                isMatched = true;
                                                                break;
                                                            }
                                                        }
                                                    } else {
                                                        reqInstanceHelper.PrintInfo(serviceName, '---- API entry NOT available for ' + curApi + ' in redis.', null);
                                                        return resolve("SUCCESS")
                                                    }
                                                    if (isMatched) {
                                                        resolve("SUCCESS")
                                                    } else {
                                                        resolve("FAILURE")
                                                    }
                                                } else {
                                                    resolve("SUCCESS")
                                                }
                                            } else {
                                                reqInstanceHelper.PrintInfo(serviceName, '---- Access privileges entry not available no need to validate ----', null);
                                                resolve("SUCCESS")
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.PrintInfo(serviceName, 'Exception occured ' + error, null);
                                        }
                                    })
                                }
                                function sendresponse(pdata) {
                                    try {
                                        var response = {};
                                        response.data = pdata;
                                        response.process_status = "FAILURE";
                                        response.service_status = "FAILURE";
                                        response.error_code = "401";
                                        res.send(response)

                                    } catch (error) {
                                        console.log(error)
                                    }
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-23006+', 'Error in CheckRedisSession ', error);
                        }
                    }
                }

                function decryptpayload() {
                    try {
                        if (req.method.toUpperCase() == 'POST') {
                            // var stringparam = xss(JSON.stringify(req.body));
                            // req.body = JSON.parse(stringparam)
                            var files = req.files
                            var objfiles = {}
                            if (files && files.length) {
                                for (var i = 0; i < files.length; i++) {
                                    objfiles[files[i].originalname] = {
                                        data: files[i].buffer,
                                        encoding: files[i].encoding,
                                        mimetype: files[i].mimetype,
                                        name: files[i].originalname,
                                        size: files[i].size
                                    }
                                }
                                req.files = objfiles
                            }
                            if (req.body.enc) {
                                req.body = JSON.parse(reqEncryptionInstance.DecryptPassword(req.body.enc));
                                next();
                            } else {
                                next();
                            }
                        } else if (req.method.toUpperCase() == 'GET') {
                            if (req.query) {
                                var stringparam = xss(JSON.stringify(req.query));
                                req.query = JSON.parse(stringparam)
                            }
                            next();
                        } else {
                            next();
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230066', 'Error in decryptpayload ', error);
                    }
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230067', 'Error in privateDecryption ', error);
            }

        }

        app.use(privateDecryption);
        for (var i = 0; i < pRoutes.length; i++) {
            app.use('/' + pServiceName, pRoutes[i]);
        }

        // catch 404 and forward to error handler
        app.use(function (req, res, next) {
            var err = new Error(req.path + ' Not Found');
            err.status = 404;
            next(err);
        });


        // error handlers
        app.use(error);



        function error(err, req, res, next) {
            // log it
            console.error(err.stack);
            // respond with 500 "Internal Server Error".
            res.status(err.status || 500).send({
                error: err.message
            });
        }

        // development error handler
        // will print stacktrace
        if (app.get('env') === 'development') {
            app.use(function (err, req, res, next) {
                res.status(err.status || 500);
                res.render('error', {
                    message: err.message,
                    error: err
                });
            });
        }

        // production error handler
        // no stacktraces leaked to user
        app.use(function (err, req, res, next) {
            res.status(err.status || 500);
            res.render('error', {
                message: err.message,
                error: {}
            });
        });

        // process.on('uncaughtException', function(error) {
        //     reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230013', 'Error in uncaughtException callback', error);
        //     var fs = require('fs');
        //     fs.appendFile(path.join(pServiceLocation, 'uncaughtException.txt'), error.stack, function(pErr) {
        //         if (pErr) {
        //             return console.log(pErr);
        //         }
        //         reqInstanceHelper.PrintInfo(serviceName, 'UncaughtException was saved!', '', null);
        //     });
        // });

        // throw (new Error("Testing"))
        var http = require('http');
        var server = http.createServer(app);
        mServer = server;
        process.on('SIGINT', function () {
            server.close(function () {
                // Cleanup connections
                DisconnectAllInstances(function (error, result) {
                    if (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230026', 'Error in DisconnectAllInstances callback', error);
                        reqInstanceHelper.PrintInfo(serviceName, 'Some instances are not disconnected');
                        process.exit(0);
                    } else {
                        reqInstanceHelper.PrintInfo(serviceName, 'All instances are disconnected successfully');
                        process.exit(0);
                    }
                });
            });
        });

        // process.on('SIGTERM', function () {
        //     console.log('SIGTERM');
        // });

        // process.on('exit', function () {
        //     console.log('exit');
        // });
        reqInstanceHelper.ReadConfigFile(function (error, pConfig) {
            if (error) {
                reqInstanceHelper.PrintError(pServiceName, objLogInfo, 'errcode', 'errmsg', error);
            } else {
                server.listen(pConfig.ServicePort[pServiceName]);
                if (process.title == 'Torus_Svc_Exchange') {
                    server.timeout = 1800000 // (ms)30 Minute;
                } else {
                    server.timeout = 600000 // (ms)10 Minute;
                }
                exports.Server = server;
                module.exports = app;
                reqInstanceHelper.PrintInfo(serviceName, '---- Service started successfully ----', null);
                reqInstanceHelper.PrintInfo(serviceName, '---- Service listening in ' + pConfig.ServicePort[pServiceName] + ' ----', null);
                // To Write a Service Log file while Starting Service Only...
                var ServiceInfo = reqInstanceHelper.GetServiceInfo(process.title, 'Start/');
                var fileContent = {
                    SERVICE_NAME: process.title,
                    DATE_AND_TIME: reqMoment(new Date()).format('YYYY-MM-DD    hh-mm-ss-SSSS A')
                };
                var strFileContent = JSON.stringify(fileContent);;
                var headers = (objLogInfo && objLogInfo.headers) || {};
                headers.startWith = 'START_';
                headers.file_extension = '.json';
                var fileName = null;
                fileName = reqInstanceHelper.GetServiceFileName(headers);
                // console.log(ServiceInfo.service_folder_path, '----------------------');
                if (ServiceInfo.service_folder_path) {
                    reqInstanceHelper.WriteServiceLog(ServiceInfo.service_folder_path, fileName, strFileContent, function () {
                    });
                }
            }
        });

        setInterval(checkAllInstances, 30000, function (result) {
            if (result == 'SUCCESS') {
                //reqInstanceHelper.PrintInfo(serviceName, '------ Service is running successfully ------');
            } else {
                reqInstanceHelper.PrintInfo(serviceName, '------ Health Checkup of intances ------', null);
                reqInstanceHelper.PrintInfo(serviceName, result, null);
                reqInstanceHelper.PrintInfo(serviceName, '------ Service is running with some failures ------ ', null);
            }
        });

        // GC COLLECT
        // Call GC collect and set interval time
        var interval = GetGcIntervalTime(pServiceName);
        var gcHelperPath = path.resolve(path.join(__dirname, '../common/gc/GcHelper'));
        if (global.gc) {
            console.log("Garbage Collection Enabled");
        } else {
            console.log("Garbage Collection Disabled");
        }
        setInterval(function () {
            Exec_child_process_for_gc(gcHelperPath, function (data) {
                //console.log(data);
            });
        }, interval);
    }

    // disconnect all instances befor close service
    function DisconnectAllInstances(callback) {
        var isCassandraDisconnected = false;
        var isTranDBDisconnected = false;
        var isKafkaDisconnected = false;
        var isSolrDisconnected = false;
        var isRedisDisconnected = false;
        var isAnalyticsDisconnected = false;
        var isIMAPDisconnected = false;
        var disconnectError = null;

        function successCall() {
            if (isCassandraDisconnected && isTranDBDisconnected && isKafkaDisconnected && isSolrDisconnected && isRedisDisconnected && isAnalyticsDisconnected && isIMAPDisconnected) {
                if (disconnectError) {
                    return callback(disconnectError);
                } else {
                    return callback();
                }
                //clientRedis.quit();
            }
        }
        reqCassandraInstance.Disconnect(function (error, result) {
            if (error) {
                disconnectError = error;
            }
            isCassandraDisconnected = true;
            successCall();
        });
        reqTranDBInstance.Disconnect(function (error, result) {
            if (error) {
                disconnectError = error;
            }
            isTranDBDisconnected = true;
            successCall();
        });
        reqKafkaInstance.Disconnect(function (error, result) {
            if (error) {
                disconnectError = error;
            }
            isKafkaDisconnected = true;
            successCall();
        });
        reqSolrInstance.Disconnect(function (error, result) {
            if (error) {
                disconnectError = error;
            }
            isSolrDisconnected = true;
            successCall();
        });
        reqRedisInstance.Disconnect(function (error, result) {
            if (error) {
                disconnectError = error;
            }
            isRedisDisconnected = true;
            successCall();
        });
        reqAnalyticInstance.Disconnect(function (error, result) {
            if (error) {
                disconnectError = error;
            }
            isAnalyticsDisconnected = true;
            successCall();
        });
        reqIMAPMailReceiver.Disconnect(function (error, result) {
            if (error) {
                disconnectError = error;
            }
            isIMAPDisconnected = true;
            successCall();
        });
    }

    // start consumer from app.js
    function startConsumer(pConsumerName, pConsumer, pTopic, pGroup, pHeaders, pOptionalParam, startConsumerCB) {
        try {
            var express = require('express');
            var app = express();
            var serviceModel = (reqDBInstance.DBInstanceSession && reqDBInstance.DBInstanceSession['SERVICE_MODEL']) || null;
            reqInstanceHelper.PrintInfo(serviceName, 'Starting ' + process.title + ' Program...', objLogInfo);
            if (serviceModel) {
                if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                    reqInstanceHelper.PrintInfo(serviceName, 'PLATFORM_VERSION 7.0', objLogInfo);
                    var ConumsersList = ['Torus_Bg_LogConsumer', 'Torus_Bg_TranJourneyConsumer', 'Torus_Bg_CommProcessDataConsumer', 'Torus_Bg_CommMessageSenderConsumer', 'Torus_Bg_CommProcessMsgSuccessConsumer', 'Torus_Bg_CommProcessMsgFailureConsumer', 'Torus_Bg_AttachmentConsumer', 'Torus_Bg_FxTranConsumer', 'Torus_Bg_TranVersionDetailConsumer', 'Torus_Bg_SaveAtmtConsumer', 'Torus_Bg_APCP-OTPConsumer', 'Torus_Bg_WP-OTPConsumer'];
                    if (ConumsersList.indexOf(process.title) > -1) {
                        reqKafkaInstance.GetConsumer(pTopic, pGroup, pHeaders, CBGetKafka, pOptionalParam);
                    } else {
                        reqInstanceHelper.PrintInfo(serviceName, 'Kafka Connectors Will be Used for this Process...', objLogInfo);
                        return;
                    }
                } else {
                    var Consumer = ['Torus_Bg_APCP-OTPConsumer', 'Torus_Bg_AuditLogConsumer', 'Torus_Bg_LogConsumer', 'Torus_Bg_PrctConsumer', 'Torus_Bg_SaveAtmtConsumer',
                        'Torus_Bg_SaveTranConsumer', 'Torus_Bg_WP-OTPConsumer'];
                    if (Consumer.indexOf(process.title) > -1) {
                        reqInstanceHelper.PrintInfo(serviceName, 'OLD PLATFORM_VERSION.... ', objLogInfo);
                        reqKafkaInstance.GetConsumer(pTopic, pGroup, pHeaders, CBGetKafka, pOptionalParam);
                    } else {
                        reqInstanceHelper.PrintInfo(serviceName, 'Consumer is not support for this platform version ', objLogInfo);
                        return;
                    }
                }
            } else {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230068', 'Service Model is Not Available', null);
                reqInstanceHelper.PrintInfo(serviceName, pConsumerName + ' starting...', null);
                reqKafkaInstance.GetConsumer(pTopic, pGroup, pHeaders, CBGetKafka, pOptionalParam);
            }

            function CBGetKafka(kafkaConsumer) {
                try {
                    if (!kafkaConsumer) {
                        reqInstanceHelper.PrintInfo(serviceName, 'Kafka is not running...', null);
                    } else {
                        reqKafkaInstance.GetKafkaInstance(pHeaders, function (kafka) {
                            try {
                                pConsumer.StartConsuming(pConsumerName, pTopic, kafkaConsumer, kafka);
                                if (startConsumerCB) {
                                    startConsumerCB();
                                }
                            } catch (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230018', 'Error in GetKafkaInstance callback', error);
                            }
                        });

                        var http = require('http');
                        var server = http.createServer(app);

                        process.on('SIGINT', function () {
                            server.close(function () {
                                // Cleanup connections
                                DisconnectAllInstances(function (error, result) {
                                    if (error) {
                                        reqInstanceHelper.PrintInfo(serviceName, 'Some instances are not disconnected');
                                        process.exit(0);
                                    } else {
                                        reqInstanceHelper.PrintInfo(serviceName, 'All instances are disconnected successfully');
                                        process.exit(0);
                                    }
                                });
                            });
                        });

                        module.exports = app;
                        reqInstanceHelper.PrintInfo(serviceName, pConsumerName + ' started successfully.', null);
                    }
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230014', 'Error in CBGetKafka function', error);
                }
            }

        } catch (error) {
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230015', 'Error in startConsumer function', error);
        }
    }

    function GetGcIntervalTime(module) {
        var json_interval = require('../common/gc/gcinterval.json');
        return (json_interval[module] !== undefined) ? json_interval[module] : 10000;
    }

    function Exec_child_process_for_gc(pGcHelperPath, callback) {
        var cp = require('child_process');
        var child = cp.fork(pGcHelperPath);
        var strMsg = '';
        child.send(strMsg);
        child.on('message', function (m) {
            process.kill(child.pid);
            callback(m);
        });
    }

    // check all connected instances are active
    function checkAllInstances(callback) {
        try {
            var returnVal = 'SUCCESS';
            var isCassandraDone = false;
            // var isTranDBDone = false;
            // var isSolrDone = false;
            // var isKafkaDone = false;
            function successCall() {
                if (isCassandraDone) {
                    return callback(returnVal);
                }
            }
            //reqInstanceHelper.PrintInfo(serviceName, '------ Health Checkup of intances ------', null);
            reqCassandraInstance.CheckAllCassandraAvail(function (result) {
                try {
                    isCassandraDone = true;
                    if (result != 'SUCCESS') {
                        returnVal = result;
                    }
                    successCall();
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230016', 'Error in CheckAllCassandraAvail callback', error);
                }
            });
            // tranDBInstance.CheckAllTranDBAvail(function (result) {
            //   try {
            //     isTranDBDone = true;
            //     if (result != 'SUCCESS') {
            //       returnVal = result;
            //     }
            //     successCall();
            //   } catch (error) {
            //     reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
            //   }
            // });
            // solrInstance.CheckAllSolrAvail(function (result) {
            //   try {
            //     isSolrDone = true;
            //     if (result != 'SUCCESS') {
            //       returnVal = result;
            //     }
            //     successCall();
            //   } catch (error) {
            //     reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
            //   }
            // });
            // kafkaInstance.CheckAllKafkaAvail(function (result) {
            //   try {
            //     isKafkaDone = true;
            //     if (result != 'SUCCESS') {
            //       returnVal = result;
            //     }
            //     successCall();
            //   } catch (error) {
            //     reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
            //   }
            // });
        } catch (error) {
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230025', 'Error in checkAllInstances function', error);
        }
    }

    function GetPlatformVersion(params, GetPlatformVersionCB) {
        try {
            var GetPlatformVersionInfo = {};
            var serviceModel = (reqDBInstance.DBInstanceSession && reqDBInstance.DBInstanceSession['SERVICE_MODEL']) || null;
            if (serviceModel) {
                if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                    reqInstanceHelper.PrintInfo(serviceName, 'PLATFORM_VERSION 7.0', objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, 'Stopping ' + process.title + ' Program...', objLogInfo);
                    GetPlatformVersionInfo.status = false;//To Stop Producer Programs...
                    GetPlatformVersionCB(GetPlatformVersionInfo);
                } else {
                    reqInstanceHelper.PrintInfo(serviceName, 'OLD PLATFORM_VERSION.... ', objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, 'Starting ' + process.title + ' Program...', objLogInfo);
                    GetPlatformVersionInfo.status = true;
                    GetPlatformVersionCB(GetPlatformVersionInfo);
                }
            } else {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230068', 'Service Model is Not Available', null);
                GetPlatformVersionInfo.status = true;
                reqInstanceHelper.PrintInfo(serviceName, 'Starting ' + process.title + ' Program...', objLogInfo);
                GetPlatformVersionCB(GetPlatformVersionInfo);
            }
        } catch (error) {
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230069', 'Catch Error in GetPlatformVersion()...', error);
            reqInstanceHelper.PrintInfo(serviceName, 'Starting ' + process.title + ' Program...', objLogInfo);
            GetPlatformVersionInfo.status = true;
            GetPlatformVersionCB(GetPlatformVersionInfo);

        }

    }

    function GetAppServer() {
        console.log('Getting App Server');
        return mServer;
    }

    module.exports = {
        LoadAllInstanses: loadAllInstanses,
        StartService: startService,
        StartConsumer: startConsumer,
        //GetRedisValue: getRedisValue,
        DisconnectAllInstances: DisconnectAllInstances,
        AppServer: GetAppServer,
        GetPlatformVersion: GetPlatformVersion
    };
    /************ End of File ************/
} catch (error) {
    console.log(error, 'Catch Error in AppHelper File');
    // reqInstanceHelper.PrintError('AppHelper', null, 'ERR-REF-230071', 'Catch Error in AppHelper File....', error);
}
