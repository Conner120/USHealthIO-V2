/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
"use strict";

var $protobuf = require("protobufjs/minimal");

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.provider = (function() {

    /**
     * Namespace provider.
     * @exports provider
     * @namespace
     */
    var provider = {};

    provider.ProtoProviderNegotiationKafkaMessage = (function() {

        /**
         * Properties of a ProtoProviderNegotiationKafkaMessage.
         * @memberof provider
         * @interface IProtoProviderNegotiationKafkaMessage
         * @property {provider.IProtoProcedureKafkaMessage|null} [procedure] ProtoProviderNegotiationKafkaMessage procedure
         * @property {Array.<provider.IProtoProviderMessage>|null} [providerGroup] ProtoProviderNegotiationKafkaMessage providerGroup
         * @property {Array.<provider.IProtoNegotiatedPriceKafkaMessage>|null} [negotiatedPrices] ProtoProviderNegotiationKafkaMessage negotiatedPrices
         */

        /**
         * Constructs a new ProtoProviderNegotiationKafkaMessage.
         * @memberof provider
         * @classdesc Represents a ProtoProviderNegotiationKafkaMessage.
         * @implements IProtoProviderNegotiationKafkaMessage
         * @constructor
         * @param {provider.IProtoProviderNegotiationKafkaMessage=} [properties] Properties to set
         */
        function ProtoProviderNegotiationKafkaMessage(properties) {
            this.providerGroup = [];
            this.negotiatedPrices = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ProtoProviderNegotiationKafkaMessage procedure.
         * @member {provider.IProtoProcedureKafkaMessage|null|undefined} procedure
         * @memberof provider.ProtoProviderNegotiationKafkaMessage
         * @instance
         */
        ProtoProviderNegotiationKafkaMessage.prototype.procedure = null;

        /**
         * ProtoProviderNegotiationKafkaMessage providerGroup.
         * @member {Array.<provider.IProtoProviderMessage>} providerGroup
         * @memberof provider.ProtoProviderNegotiationKafkaMessage
         * @instance
         */
        ProtoProviderNegotiationKafkaMessage.prototype.providerGroup = $util.emptyArray;

        /**
         * ProtoProviderNegotiationKafkaMessage negotiatedPrices.
         * @member {Array.<provider.IProtoNegotiatedPriceKafkaMessage>} negotiatedPrices
         * @memberof provider.ProtoProviderNegotiationKafkaMessage
         * @instance
         */
        ProtoProviderNegotiationKafkaMessage.prototype.negotiatedPrices = $util.emptyArray;

        /**
         * Creates a new ProtoProviderNegotiationKafkaMessage instance using the specified properties.
         * @function create
         * @memberof provider.ProtoProviderNegotiationKafkaMessage
         * @static
         * @param {provider.IProtoProviderNegotiationKafkaMessage=} [properties] Properties to set
         * @returns {provider.ProtoProviderNegotiationKafkaMessage} ProtoProviderNegotiationKafkaMessage instance
         */
        ProtoProviderNegotiationKafkaMessage.create = function create(properties) {
            return new ProtoProviderNegotiationKafkaMessage(properties);
        };

        /**
         * Encodes the specified ProtoProviderNegotiationKafkaMessage message. Does not implicitly {@link provider.ProtoProviderNegotiationKafkaMessage.verify|verify} messages.
         * @function encode
         * @memberof provider.ProtoProviderNegotiationKafkaMessage
         * @static
         * @param {provider.IProtoProviderNegotiationKafkaMessage} message ProtoProviderNegotiationKafkaMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ProtoProviderNegotiationKafkaMessage.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.procedure != null && Object.hasOwnProperty.call(message, "procedure"))
                $root.provider.ProtoProcedureKafkaMessage.encode(message.procedure, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            if (message.providerGroup != null && message.providerGroup.length)
                for (var i = 0; i < message.providerGroup.length; ++i)
                    $root.provider.ProtoProviderMessage.encode(message.providerGroup[i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
            if (message.negotiatedPrices != null && message.negotiatedPrices.length)
                for (var i = 0; i < message.negotiatedPrices.length; ++i)
                    $root.provider.ProtoNegotiatedPriceKafkaMessage.encode(message.negotiatedPrices[i], writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified ProtoProviderNegotiationKafkaMessage message, length delimited. Does not implicitly {@link provider.ProtoProviderNegotiationKafkaMessage.verify|verify} messages.
         * @function encodeDelimited
         * @memberof provider.ProtoProviderNegotiationKafkaMessage
         * @static
         * @param {provider.IProtoProviderNegotiationKafkaMessage} message ProtoProviderNegotiationKafkaMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ProtoProviderNegotiationKafkaMessage.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ProtoProviderNegotiationKafkaMessage message from the specified reader or buffer.
         * @function decode
         * @memberof provider.ProtoProviderNegotiationKafkaMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {provider.ProtoProviderNegotiationKafkaMessage} ProtoProviderNegotiationKafkaMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ProtoProviderNegotiationKafkaMessage.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.provider.ProtoProviderNegotiationKafkaMessage();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.procedure = $root.provider.ProtoProcedureKafkaMessage.decode(reader, reader.uint32());
                        break;
                    }
                case 2: {
                        if (!(message.providerGroup && message.providerGroup.length))
                            message.providerGroup = [];
                        message.providerGroup.push($root.provider.ProtoProviderMessage.decode(reader, reader.uint32()));
                        break;
                    }
                case 3: {
                        if (!(message.negotiatedPrices && message.negotiatedPrices.length))
                            message.negotiatedPrices = [];
                        message.negotiatedPrices.push($root.provider.ProtoNegotiatedPriceKafkaMessage.decode(reader, reader.uint32()));
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a ProtoProviderNegotiationKafkaMessage message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof provider.ProtoProviderNegotiationKafkaMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {provider.ProtoProviderNegotiationKafkaMessage} ProtoProviderNegotiationKafkaMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ProtoProviderNegotiationKafkaMessage.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ProtoProviderNegotiationKafkaMessage message.
         * @function verify
         * @memberof provider.ProtoProviderNegotiationKafkaMessage
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ProtoProviderNegotiationKafkaMessage.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.procedure != null && message.hasOwnProperty("procedure")) {
                var error = $root.provider.ProtoProcedureKafkaMessage.verify(message.procedure);
                if (error)
                    return "procedure." + error;
            }
            if (message.providerGroup != null && message.hasOwnProperty("providerGroup")) {
                if (!Array.isArray(message.providerGroup))
                    return "providerGroup: array expected";
                for (var i = 0; i < message.providerGroup.length; ++i) {
                    var error = $root.provider.ProtoProviderMessage.verify(message.providerGroup[i]);
                    if (error)
                        return "providerGroup." + error;
                }
            }
            if (message.negotiatedPrices != null && message.hasOwnProperty("negotiatedPrices")) {
                if (!Array.isArray(message.negotiatedPrices))
                    return "negotiatedPrices: array expected";
                for (var i = 0; i < message.negotiatedPrices.length; ++i) {
                    var error = $root.provider.ProtoNegotiatedPriceKafkaMessage.verify(message.negotiatedPrices[i]);
                    if (error)
                        return "negotiatedPrices." + error;
                }
            }
            return null;
        };

        /**
         * Creates a ProtoProviderNegotiationKafkaMessage message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof provider.ProtoProviderNegotiationKafkaMessage
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {provider.ProtoProviderNegotiationKafkaMessage} ProtoProviderNegotiationKafkaMessage
         */
        ProtoProviderNegotiationKafkaMessage.fromObject = function fromObject(object) {
            if (object instanceof $root.provider.ProtoProviderNegotiationKafkaMessage)
                return object;
            var message = new $root.provider.ProtoProviderNegotiationKafkaMessage();
            if (object.procedure != null) {
                if (typeof object.procedure !== "object")
                    throw TypeError(".provider.ProtoProviderNegotiationKafkaMessage.procedure: object expected");
                message.procedure = $root.provider.ProtoProcedureKafkaMessage.fromObject(object.procedure);
            }
            if (object.providerGroup) {
                if (!Array.isArray(object.providerGroup))
                    throw TypeError(".provider.ProtoProviderNegotiationKafkaMessage.providerGroup: array expected");
                message.providerGroup = [];
                for (var i = 0; i < object.providerGroup.length; ++i) {
                    if (typeof object.providerGroup[i] !== "object")
                        throw TypeError(".provider.ProtoProviderNegotiationKafkaMessage.providerGroup: object expected");
                    message.providerGroup[i] = $root.provider.ProtoProviderMessage.fromObject(object.providerGroup[i]);
                }
            }
            if (object.negotiatedPrices) {
                if (!Array.isArray(object.negotiatedPrices))
                    throw TypeError(".provider.ProtoProviderNegotiationKafkaMessage.negotiatedPrices: array expected");
                message.negotiatedPrices = [];
                for (var i = 0; i < object.negotiatedPrices.length; ++i) {
                    if (typeof object.negotiatedPrices[i] !== "object")
                        throw TypeError(".provider.ProtoProviderNegotiationKafkaMessage.negotiatedPrices: object expected");
                    message.negotiatedPrices[i] = $root.provider.ProtoNegotiatedPriceKafkaMessage.fromObject(object.negotiatedPrices[i]);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from a ProtoProviderNegotiationKafkaMessage message. Also converts values to other types if specified.
         * @function toObject
         * @memberof provider.ProtoProviderNegotiationKafkaMessage
         * @static
         * @param {provider.ProtoProviderNegotiationKafkaMessage} message ProtoProviderNegotiationKafkaMessage
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ProtoProviderNegotiationKafkaMessage.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults) {
                object.providerGroup = [];
                object.negotiatedPrices = [];
            }
            if (options.defaults)
                object.procedure = null;
            if (message.procedure != null && message.hasOwnProperty("procedure"))
                object.procedure = $root.provider.ProtoProcedureKafkaMessage.toObject(message.procedure, options);
            if (message.providerGroup && message.providerGroup.length) {
                object.providerGroup = [];
                for (var j = 0; j < message.providerGroup.length; ++j)
                    object.providerGroup[j] = $root.provider.ProtoProviderMessage.toObject(message.providerGroup[j], options);
            }
            if (message.negotiatedPrices && message.negotiatedPrices.length) {
                object.negotiatedPrices = [];
                for (var j = 0; j < message.negotiatedPrices.length; ++j)
                    object.negotiatedPrices[j] = $root.provider.ProtoNegotiatedPriceKafkaMessage.toObject(message.negotiatedPrices[j], options);
            }
            return object;
        };

        /**
         * Converts this ProtoProviderNegotiationKafkaMessage to JSON.
         * @function toJSON
         * @memberof provider.ProtoProviderNegotiationKafkaMessage
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ProtoProviderNegotiationKafkaMessage.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ProtoProviderNegotiationKafkaMessage
         * @function getTypeUrl
         * @memberof provider.ProtoProviderNegotiationKafkaMessage
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ProtoProviderNegotiationKafkaMessage.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/provider.ProtoProviderNegotiationKafkaMessage";
        };

        return ProtoProviderNegotiationKafkaMessage;
    })();

    provider.ProtoProviderMessage = (function() {

        /**
         * Properties of a ProtoProviderMessage.
         * @memberof provider
         * @interface IProtoProviderMessage
         * @property {Array.<string>|null} [networkName] ProtoProviderMessage networkName
         * @property {Array.<provider.IProtoProviderObject>|null} [providerGroups] ProtoProviderMessage providerGroups
         */

        /**
         * Constructs a new ProtoProviderMessage.
         * @memberof provider
         * @classdesc Represents a ProtoProviderMessage.
         * @implements IProtoProviderMessage
         * @constructor
         * @param {provider.IProtoProviderMessage=} [properties] Properties to set
         */
        function ProtoProviderMessage(properties) {
            this.networkName = [];
            this.providerGroups = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ProtoProviderMessage networkName.
         * @member {Array.<string>} networkName
         * @memberof provider.ProtoProviderMessage
         * @instance
         */
        ProtoProviderMessage.prototype.networkName = $util.emptyArray;

        /**
         * ProtoProviderMessage providerGroups.
         * @member {Array.<provider.IProtoProviderObject>} providerGroups
         * @memberof provider.ProtoProviderMessage
         * @instance
         */
        ProtoProviderMessage.prototype.providerGroups = $util.emptyArray;

        /**
         * Creates a new ProtoProviderMessage instance using the specified properties.
         * @function create
         * @memberof provider.ProtoProviderMessage
         * @static
         * @param {provider.IProtoProviderMessage=} [properties] Properties to set
         * @returns {provider.ProtoProviderMessage} ProtoProviderMessage instance
         */
        ProtoProviderMessage.create = function create(properties) {
            return new ProtoProviderMessage(properties);
        };

        /**
         * Encodes the specified ProtoProviderMessage message. Does not implicitly {@link provider.ProtoProviderMessage.verify|verify} messages.
         * @function encode
         * @memberof provider.ProtoProviderMessage
         * @static
         * @param {provider.IProtoProviderMessage} message ProtoProviderMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ProtoProviderMessage.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.networkName != null && message.networkName.length)
                for (var i = 0; i < message.networkName.length; ++i)
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.networkName[i]);
            if (message.providerGroups != null && message.providerGroups.length)
                for (var i = 0; i < message.providerGroups.length; ++i)
                    $root.provider.ProtoProviderObject.encode(message.providerGroups[i], writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified ProtoProviderMessage message, length delimited. Does not implicitly {@link provider.ProtoProviderMessage.verify|verify} messages.
         * @function encodeDelimited
         * @memberof provider.ProtoProviderMessage
         * @static
         * @param {provider.IProtoProviderMessage} message ProtoProviderMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ProtoProviderMessage.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ProtoProviderMessage message from the specified reader or buffer.
         * @function decode
         * @memberof provider.ProtoProviderMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {provider.ProtoProviderMessage} ProtoProviderMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ProtoProviderMessage.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.provider.ProtoProviderMessage();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.networkName && message.networkName.length))
                            message.networkName = [];
                        message.networkName.push(reader.string());
                        break;
                    }
                case 2: {
                        if (!(message.providerGroups && message.providerGroups.length))
                            message.providerGroups = [];
                        message.providerGroups.push($root.provider.ProtoProviderObject.decode(reader, reader.uint32()));
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a ProtoProviderMessage message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof provider.ProtoProviderMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {provider.ProtoProviderMessage} ProtoProviderMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ProtoProviderMessage.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ProtoProviderMessage message.
         * @function verify
         * @memberof provider.ProtoProviderMessage
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ProtoProviderMessage.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.networkName != null && message.hasOwnProperty("networkName")) {
                if (!Array.isArray(message.networkName))
                    return "networkName: array expected";
                for (var i = 0; i < message.networkName.length; ++i)
                    if (!$util.isString(message.networkName[i]))
                        return "networkName: string[] expected";
            }
            if (message.providerGroups != null && message.hasOwnProperty("providerGroups")) {
                if (!Array.isArray(message.providerGroups))
                    return "providerGroups: array expected";
                for (var i = 0; i < message.providerGroups.length; ++i) {
                    var error = $root.provider.ProtoProviderObject.verify(message.providerGroups[i]);
                    if (error)
                        return "providerGroups." + error;
                }
            }
            return null;
        };

        /**
         * Creates a ProtoProviderMessage message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof provider.ProtoProviderMessage
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {provider.ProtoProviderMessage} ProtoProviderMessage
         */
        ProtoProviderMessage.fromObject = function fromObject(object) {
            if (object instanceof $root.provider.ProtoProviderMessage)
                return object;
            var message = new $root.provider.ProtoProviderMessage();
            if (object.networkName) {
                if (!Array.isArray(object.networkName))
                    throw TypeError(".provider.ProtoProviderMessage.networkName: array expected");
                message.networkName = [];
                for (var i = 0; i < object.networkName.length; ++i)
                    message.networkName[i] = String(object.networkName[i]);
            }
            if (object.providerGroups) {
                if (!Array.isArray(object.providerGroups))
                    throw TypeError(".provider.ProtoProviderMessage.providerGroups: array expected");
                message.providerGroups = [];
                for (var i = 0; i < object.providerGroups.length; ++i) {
                    if (typeof object.providerGroups[i] !== "object")
                        throw TypeError(".provider.ProtoProviderMessage.providerGroups: object expected");
                    message.providerGroups[i] = $root.provider.ProtoProviderObject.fromObject(object.providerGroups[i]);
                }
            }
            return message;
        };

        /**
         * Creates a plain object from a ProtoProviderMessage message. Also converts values to other types if specified.
         * @function toObject
         * @memberof provider.ProtoProviderMessage
         * @static
         * @param {provider.ProtoProviderMessage} message ProtoProviderMessage
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ProtoProviderMessage.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults) {
                object.networkName = [];
                object.providerGroups = [];
            }
            if (message.networkName && message.networkName.length) {
                object.networkName = [];
                for (var j = 0; j < message.networkName.length; ++j)
                    object.networkName[j] = message.networkName[j];
            }
            if (message.providerGroups && message.providerGroups.length) {
                object.providerGroups = [];
                for (var j = 0; j < message.providerGroups.length; ++j)
                    object.providerGroups[j] = $root.provider.ProtoProviderObject.toObject(message.providerGroups[j], options);
            }
            return object;
        };

        /**
         * Converts this ProtoProviderMessage to JSON.
         * @function toJSON
         * @memberof provider.ProtoProviderMessage
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ProtoProviderMessage.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ProtoProviderMessage
         * @function getTypeUrl
         * @memberof provider.ProtoProviderMessage
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ProtoProviderMessage.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/provider.ProtoProviderMessage";
        };

        return ProtoProviderMessage;
    })();

    provider.ProtoProviderObject = (function() {

        /**
         * Properties of a ProtoProviderObject.
         * @memberof provider
         * @interface IProtoProviderObject
         * @property {Array.<string>|null} [npi] ProtoProviderObject npi
         * @property {provider.IProtoTaxIdentifier|null} [tin] ProtoProviderObject tin
         */

        /**
         * Constructs a new ProtoProviderObject.
         * @memberof provider
         * @classdesc Represents a ProtoProviderObject.
         * @implements IProtoProviderObject
         * @constructor
         * @param {provider.IProtoProviderObject=} [properties] Properties to set
         */
        function ProtoProviderObject(properties) {
            this.npi = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ProtoProviderObject npi.
         * @member {Array.<string>} npi
         * @memberof provider.ProtoProviderObject
         * @instance
         */
        ProtoProviderObject.prototype.npi = $util.emptyArray;

        /**
         * ProtoProviderObject tin.
         * @member {provider.IProtoTaxIdentifier|null|undefined} tin
         * @memberof provider.ProtoProviderObject
         * @instance
         */
        ProtoProviderObject.prototype.tin = null;

        /**
         * Creates a new ProtoProviderObject instance using the specified properties.
         * @function create
         * @memberof provider.ProtoProviderObject
         * @static
         * @param {provider.IProtoProviderObject=} [properties] Properties to set
         * @returns {provider.ProtoProviderObject} ProtoProviderObject instance
         */
        ProtoProviderObject.create = function create(properties) {
            return new ProtoProviderObject(properties);
        };

        /**
         * Encodes the specified ProtoProviderObject message. Does not implicitly {@link provider.ProtoProviderObject.verify|verify} messages.
         * @function encode
         * @memberof provider.ProtoProviderObject
         * @static
         * @param {provider.IProtoProviderObject} message ProtoProviderObject message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ProtoProviderObject.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.npi != null && message.npi.length)
                for (var i = 0; i < message.npi.length; ++i)
                    writer.uint32(/* id 1, wireType 2 =*/10).string(message.npi[i]);
            if (message.tin != null && Object.hasOwnProperty.call(message, "tin"))
                $root.provider.ProtoTaxIdentifier.encode(message.tin, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
            return writer;
        };

        /**
         * Encodes the specified ProtoProviderObject message, length delimited. Does not implicitly {@link provider.ProtoProviderObject.verify|verify} messages.
         * @function encodeDelimited
         * @memberof provider.ProtoProviderObject
         * @static
         * @param {provider.IProtoProviderObject} message ProtoProviderObject message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ProtoProviderObject.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ProtoProviderObject message from the specified reader or buffer.
         * @function decode
         * @memberof provider.ProtoProviderObject
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {provider.ProtoProviderObject} ProtoProviderObject
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ProtoProviderObject.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.provider.ProtoProviderObject();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.npi && message.npi.length))
                            message.npi = [];
                        message.npi.push(reader.string());
                        break;
                    }
                case 2: {
                        message.tin = $root.provider.ProtoTaxIdentifier.decode(reader, reader.uint32());
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a ProtoProviderObject message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof provider.ProtoProviderObject
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {provider.ProtoProviderObject} ProtoProviderObject
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ProtoProviderObject.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ProtoProviderObject message.
         * @function verify
         * @memberof provider.ProtoProviderObject
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ProtoProviderObject.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.npi != null && message.hasOwnProperty("npi")) {
                if (!Array.isArray(message.npi))
                    return "npi: array expected";
                for (var i = 0; i < message.npi.length; ++i)
                    if (!$util.isString(message.npi[i]))
                        return "npi: string[] expected";
            }
            if (message.tin != null && message.hasOwnProperty("tin")) {
                var error = $root.provider.ProtoTaxIdentifier.verify(message.tin);
                if (error)
                    return "tin." + error;
            }
            return null;
        };

        /**
         * Creates a ProtoProviderObject message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof provider.ProtoProviderObject
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {provider.ProtoProviderObject} ProtoProviderObject
         */
        ProtoProviderObject.fromObject = function fromObject(object) {
            if (object instanceof $root.provider.ProtoProviderObject)
                return object;
            var message = new $root.provider.ProtoProviderObject();
            if (object.npi) {
                if (!Array.isArray(object.npi))
                    throw TypeError(".provider.ProtoProviderObject.npi: array expected");
                message.npi = [];
                for (var i = 0; i < object.npi.length; ++i)
                    message.npi[i] = String(object.npi[i]);
            }
            if (object.tin != null) {
                if (typeof object.tin !== "object")
                    throw TypeError(".provider.ProtoProviderObject.tin: object expected");
                message.tin = $root.provider.ProtoTaxIdentifier.fromObject(object.tin);
            }
            return message;
        };

        /**
         * Creates a plain object from a ProtoProviderObject message. Also converts values to other types if specified.
         * @function toObject
         * @memberof provider.ProtoProviderObject
         * @static
         * @param {provider.ProtoProviderObject} message ProtoProviderObject
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ProtoProviderObject.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.npi = [];
            if (options.defaults)
                object.tin = null;
            if (message.npi && message.npi.length) {
                object.npi = [];
                for (var j = 0; j < message.npi.length; ++j)
                    object.npi[j] = message.npi[j];
            }
            if (message.tin != null && message.hasOwnProperty("tin"))
                object.tin = $root.provider.ProtoTaxIdentifier.toObject(message.tin, options);
            return object;
        };

        /**
         * Converts this ProtoProviderObject to JSON.
         * @function toJSON
         * @memberof provider.ProtoProviderObject
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ProtoProviderObject.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ProtoProviderObject
         * @function getTypeUrl
         * @memberof provider.ProtoProviderObject
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ProtoProviderObject.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/provider.ProtoProviderObject";
        };

        return ProtoProviderObject;
    })();

    provider.ProtoTaxIdentifier = (function() {

        /**
         * Properties of a ProtoTaxIdentifier.
         * @memberof provider
         * @interface IProtoTaxIdentifier
         * @property {string|null} [type] ProtoTaxIdentifier type
         * @property {string|null} [value] ProtoTaxIdentifier value
         * @property {string|null} [businessName] ProtoTaxIdentifier businessName
         */

        /**
         * Constructs a new ProtoTaxIdentifier.
         * @memberof provider
         * @classdesc Represents a ProtoTaxIdentifier.
         * @implements IProtoTaxIdentifier
         * @constructor
         * @param {provider.IProtoTaxIdentifier=} [properties] Properties to set
         */
        function ProtoTaxIdentifier(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ProtoTaxIdentifier type.
         * @member {string} type
         * @memberof provider.ProtoTaxIdentifier
         * @instance
         */
        ProtoTaxIdentifier.prototype.type = "";

        /**
         * ProtoTaxIdentifier value.
         * @member {string} value
         * @memberof provider.ProtoTaxIdentifier
         * @instance
         */
        ProtoTaxIdentifier.prototype.value = "";

        /**
         * ProtoTaxIdentifier businessName.
         * @member {string} businessName
         * @memberof provider.ProtoTaxIdentifier
         * @instance
         */
        ProtoTaxIdentifier.prototype.businessName = "";

        /**
         * Creates a new ProtoTaxIdentifier instance using the specified properties.
         * @function create
         * @memberof provider.ProtoTaxIdentifier
         * @static
         * @param {provider.IProtoTaxIdentifier=} [properties] Properties to set
         * @returns {provider.ProtoTaxIdentifier} ProtoTaxIdentifier instance
         */
        ProtoTaxIdentifier.create = function create(properties) {
            return new ProtoTaxIdentifier(properties);
        };

        /**
         * Encodes the specified ProtoTaxIdentifier message. Does not implicitly {@link provider.ProtoTaxIdentifier.verify|verify} messages.
         * @function encode
         * @memberof provider.ProtoTaxIdentifier
         * @static
         * @param {provider.IProtoTaxIdentifier} message ProtoTaxIdentifier message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ProtoTaxIdentifier.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.type != null && Object.hasOwnProperty.call(message, "type"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.type);
            if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.value);
            if (message.businessName != null && Object.hasOwnProperty.call(message, "businessName"))
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.businessName);
            return writer;
        };

        /**
         * Encodes the specified ProtoTaxIdentifier message, length delimited. Does not implicitly {@link provider.ProtoTaxIdentifier.verify|verify} messages.
         * @function encodeDelimited
         * @memberof provider.ProtoTaxIdentifier
         * @static
         * @param {provider.IProtoTaxIdentifier} message ProtoTaxIdentifier message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ProtoTaxIdentifier.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ProtoTaxIdentifier message from the specified reader or buffer.
         * @function decode
         * @memberof provider.ProtoTaxIdentifier
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {provider.ProtoTaxIdentifier} ProtoTaxIdentifier
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ProtoTaxIdentifier.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.provider.ProtoTaxIdentifier();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.type = reader.string();
                        break;
                    }
                case 2: {
                        message.value = reader.string();
                        break;
                    }
                case 3: {
                        message.businessName = reader.string();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a ProtoTaxIdentifier message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof provider.ProtoTaxIdentifier
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {provider.ProtoTaxIdentifier} ProtoTaxIdentifier
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ProtoTaxIdentifier.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ProtoTaxIdentifier message.
         * @function verify
         * @memberof provider.ProtoTaxIdentifier
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ProtoTaxIdentifier.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.type != null && message.hasOwnProperty("type"))
                if (!$util.isString(message.type))
                    return "type: string expected";
            if (message.value != null && message.hasOwnProperty("value"))
                if (!$util.isString(message.value))
                    return "value: string expected";
            if (message.businessName != null && message.hasOwnProperty("businessName"))
                if (!$util.isString(message.businessName))
                    return "businessName: string expected";
            return null;
        };

        /**
         * Creates a ProtoTaxIdentifier message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof provider.ProtoTaxIdentifier
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {provider.ProtoTaxIdentifier} ProtoTaxIdentifier
         */
        ProtoTaxIdentifier.fromObject = function fromObject(object) {
            if (object instanceof $root.provider.ProtoTaxIdentifier)
                return object;
            var message = new $root.provider.ProtoTaxIdentifier();
            if (object.type != null)
                message.type = String(object.type);
            if (object.value != null)
                message.value = String(object.value);
            if (object.businessName != null)
                message.businessName = String(object.businessName);
            return message;
        };

        /**
         * Creates a plain object from a ProtoTaxIdentifier message. Also converts values to other types if specified.
         * @function toObject
         * @memberof provider.ProtoTaxIdentifier
         * @static
         * @param {provider.ProtoTaxIdentifier} message ProtoTaxIdentifier
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ProtoTaxIdentifier.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.type = "";
                object.value = "";
                object.businessName = "";
            }
            if (message.type != null && message.hasOwnProperty("type"))
                object.type = message.type;
            if (message.value != null && message.hasOwnProperty("value"))
                object.value = message.value;
            if (message.businessName != null && message.hasOwnProperty("businessName"))
                object.businessName = message.businessName;
            return object;
        };

        /**
         * Converts this ProtoTaxIdentifier to JSON.
         * @function toJSON
         * @memberof provider.ProtoTaxIdentifier
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ProtoTaxIdentifier.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ProtoTaxIdentifier
         * @function getTypeUrl
         * @memberof provider.ProtoTaxIdentifier
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ProtoTaxIdentifier.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/provider.ProtoTaxIdentifier";
        };

        return ProtoTaxIdentifier;
    })();

    provider.ProtoNegotiatedPriceKafkaMessage = (function() {

        /**
         * Properties of a ProtoNegotiatedPriceKafkaMessage.
         * @memberof provider
         * @interface IProtoNegotiatedPriceKafkaMessage
         * @property {string|null} [negotiatedType] ProtoNegotiatedPriceKafkaMessage negotiatedType
         * @property {number|null} [negotiatedRate] ProtoNegotiatedPriceKafkaMessage negotiatedRate
         * @property {string|null} [expirationDate] ProtoNegotiatedPriceKafkaMessage expirationDate
         * @property {Array.<string>|null} [serviceCode] ProtoNegotiatedPriceKafkaMessage serviceCode
         * @property {string|null} [billingClass] ProtoNegotiatedPriceKafkaMessage billingClass
         * @property {string|null} [setting] ProtoNegotiatedPriceKafkaMessage setting
         * @property {Array.<string>|null} [billingCodeModifier] ProtoNegotiatedPriceKafkaMessage billingCodeModifier
         * @property {Array.<string>|null} [additionalInformation] ProtoNegotiatedPriceKafkaMessage additionalInformation
         */

        /**
         * Constructs a new ProtoNegotiatedPriceKafkaMessage.
         * @memberof provider
         * @classdesc Represents a ProtoNegotiatedPriceKafkaMessage.
         * @implements IProtoNegotiatedPriceKafkaMessage
         * @constructor
         * @param {provider.IProtoNegotiatedPriceKafkaMessage=} [properties] Properties to set
         */
        function ProtoNegotiatedPriceKafkaMessage(properties) {
            this.serviceCode = [];
            this.billingCodeModifier = [];
            this.additionalInformation = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ProtoNegotiatedPriceKafkaMessage negotiatedType.
         * @member {string|null|undefined} negotiatedType
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @instance
         */
        ProtoNegotiatedPriceKafkaMessage.prototype.negotiatedType = null;

        /**
         * ProtoNegotiatedPriceKafkaMessage negotiatedRate.
         * @member {number|null|undefined} negotiatedRate
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @instance
         */
        ProtoNegotiatedPriceKafkaMessage.prototype.negotiatedRate = null;

        /**
         * ProtoNegotiatedPriceKafkaMessage expirationDate.
         * @member {string|null|undefined} expirationDate
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @instance
         */
        ProtoNegotiatedPriceKafkaMessage.prototype.expirationDate = null;

        /**
         * ProtoNegotiatedPriceKafkaMessage serviceCode.
         * @member {Array.<string>} serviceCode
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @instance
         */
        ProtoNegotiatedPriceKafkaMessage.prototype.serviceCode = $util.emptyArray;

        /**
         * ProtoNegotiatedPriceKafkaMessage billingClass.
         * @member {string|null|undefined} billingClass
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @instance
         */
        ProtoNegotiatedPriceKafkaMessage.prototype.billingClass = null;

        /**
         * ProtoNegotiatedPriceKafkaMessage setting.
         * @member {string|null|undefined} setting
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @instance
         */
        ProtoNegotiatedPriceKafkaMessage.prototype.setting = null;

        /**
         * ProtoNegotiatedPriceKafkaMessage billingCodeModifier.
         * @member {Array.<string>} billingCodeModifier
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @instance
         */
        ProtoNegotiatedPriceKafkaMessage.prototype.billingCodeModifier = $util.emptyArray;

        /**
         * ProtoNegotiatedPriceKafkaMessage additionalInformation.
         * @member {Array.<string>} additionalInformation
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @instance
         */
        ProtoNegotiatedPriceKafkaMessage.prototype.additionalInformation = $util.emptyArray;

        // OneOf field names bound to virtual getters and setters
        var $oneOfFields;

        /**
         * ProtoNegotiatedPriceKafkaMessage _negotiatedType.
         * @member {"negotiatedType"|undefined} _negotiatedType
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @instance
         */
        Object.defineProperty(ProtoNegotiatedPriceKafkaMessage.prototype, "_negotiatedType", {
            get: $util.oneOfGetter($oneOfFields = ["negotiatedType"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * ProtoNegotiatedPriceKafkaMessage _negotiatedRate.
         * @member {"negotiatedRate"|undefined} _negotiatedRate
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @instance
         */
        Object.defineProperty(ProtoNegotiatedPriceKafkaMessage.prototype, "_negotiatedRate", {
            get: $util.oneOfGetter($oneOfFields = ["negotiatedRate"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * ProtoNegotiatedPriceKafkaMessage _expirationDate.
         * @member {"expirationDate"|undefined} _expirationDate
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @instance
         */
        Object.defineProperty(ProtoNegotiatedPriceKafkaMessage.prototype, "_expirationDate", {
            get: $util.oneOfGetter($oneOfFields = ["expirationDate"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * ProtoNegotiatedPriceKafkaMessage _billingClass.
         * @member {"billingClass"|undefined} _billingClass
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @instance
         */
        Object.defineProperty(ProtoNegotiatedPriceKafkaMessage.prototype, "_billingClass", {
            get: $util.oneOfGetter($oneOfFields = ["billingClass"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * ProtoNegotiatedPriceKafkaMessage _setting.
         * @member {"setting"|undefined} _setting
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @instance
         */
        Object.defineProperty(ProtoNegotiatedPriceKafkaMessage.prototype, "_setting", {
            get: $util.oneOfGetter($oneOfFields = ["setting"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new ProtoNegotiatedPriceKafkaMessage instance using the specified properties.
         * @function create
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @static
         * @param {provider.IProtoNegotiatedPriceKafkaMessage=} [properties] Properties to set
         * @returns {provider.ProtoNegotiatedPriceKafkaMessage} ProtoNegotiatedPriceKafkaMessage instance
         */
        ProtoNegotiatedPriceKafkaMessage.create = function create(properties) {
            return new ProtoNegotiatedPriceKafkaMessage(properties);
        };

        /**
         * Encodes the specified ProtoNegotiatedPriceKafkaMessage message. Does not implicitly {@link provider.ProtoNegotiatedPriceKafkaMessage.verify|verify} messages.
         * @function encode
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @static
         * @param {provider.IProtoNegotiatedPriceKafkaMessage} message ProtoNegotiatedPriceKafkaMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ProtoNegotiatedPriceKafkaMessage.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.negotiatedType != null && Object.hasOwnProperty.call(message, "negotiatedType"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.negotiatedType);
            if (message.negotiatedRate != null && Object.hasOwnProperty.call(message, "negotiatedRate"))
                writer.uint32(/* id 2, wireType 1 =*/17).double(message.negotiatedRate);
            if (message.expirationDate != null && Object.hasOwnProperty.call(message, "expirationDate"))
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.expirationDate);
            if (message.serviceCode != null && message.serviceCode.length)
                for (var i = 0; i < message.serviceCode.length; ++i)
                    writer.uint32(/* id 4, wireType 2 =*/34).string(message.serviceCode[i]);
            if (message.billingClass != null && Object.hasOwnProperty.call(message, "billingClass"))
                writer.uint32(/* id 5, wireType 2 =*/42).string(message.billingClass);
            if (message.setting != null && Object.hasOwnProperty.call(message, "setting"))
                writer.uint32(/* id 6, wireType 2 =*/50).string(message.setting);
            if (message.billingCodeModifier != null && message.billingCodeModifier.length)
                for (var i = 0; i < message.billingCodeModifier.length; ++i)
                    writer.uint32(/* id 7, wireType 2 =*/58).string(message.billingCodeModifier[i]);
            if (message.additionalInformation != null && message.additionalInformation.length)
                for (var i = 0; i < message.additionalInformation.length; ++i)
                    writer.uint32(/* id 8, wireType 2 =*/66).string(message.additionalInformation[i]);
            return writer;
        };

        /**
         * Encodes the specified ProtoNegotiatedPriceKafkaMessage message, length delimited. Does not implicitly {@link provider.ProtoNegotiatedPriceKafkaMessage.verify|verify} messages.
         * @function encodeDelimited
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @static
         * @param {provider.IProtoNegotiatedPriceKafkaMessage} message ProtoNegotiatedPriceKafkaMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ProtoNegotiatedPriceKafkaMessage.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ProtoNegotiatedPriceKafkaMessage message from the specified reader or buffer.
         * @function decode
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {provider.ProtoNegotiatedPriceKafkaMessage} ProtoNegotiatedPriceKafkaMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ProtoNegotiatedPriceKafkaMessage.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.provider.ProtoNegotiatedPriceKafkaMessage();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.negotiatedType = reader.string();
                        break;
                    }
                case 2: {
                        message.negotiatedRate = reader.double();
                        break;
                    }
                case 3: {
                        message.expirationDate = reader.string();
                        break;
                    }
                case 4: {
                        if (!(message.serviceCode && message.serviceCode.length))
                            message.serviceCode = [];
                        message.serviceCode.push(reader.string());
                        break;
                    }
                case 5: {
                        message.billingClass = reader.string();
                        break;
                    }
                case 6: {
                        message.setting = reader.string();
                        break;
                    }
                case 7: {
                        if (!(message.billingCodeModifier && message.billingCodeModifier.length))
                            message.billingCodeModifier = [];
                        message.billingCodeModifier.push(reader.string());
                        break;
                    }
                case 8: {
                        if (!(message.additionalInformation && message.additionalInformation.length))
                            message.additionalInformation = [];
                        message.additionalInformation.push(reader.string());
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a ProtoNegotiatedPriceKafkaMessage message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {provider.ProtoNegotiatedPriceKafkaMessage} ProtoNegotiatedPriceKafkaMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ProtoNegotiatedPriceKafkaMessage.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ProtoNegotiatedPriceKafkaMessage message.
         * @function verify
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ProtoNegotiatedPriceKafkaMessage.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            var properties = {};
            if (message.negotiatedType != null && message.hasOwnProperty("negotiatedType")) {
                properties._negotiatedType = 1;
                if (!$util.isString(message.negotiatedType))
                    return "negotiatedType: string expected";
            }
            if (message.negotiatedRate != null && message.hasOwnProperty("negotiatedRate")) {
                properties._negotiatedRate = 1;
                if (typeof message.negotiatedRate !== "number")
                    return "negotiatedRate: number expected";
            }
            if (message.expirationDate != null && message.hasOwnProperty("expirationDate")) {
                properties._expirationDate = 1;
                if (!$util.isString(message.expirationDate))
                    return "expirationDate: string expected";
            }
            if (message.serviceCode != null && message.hasOwnProperty("serviceCode")) {
                if (!Array.isArray(message.serviceCode))
                    return "serviceCode: array expected";
                for (var i = 0; i < message.serviceCode.length; ++i)
                    if (!$util.isString(message.serviceCode[i]))
                        return "serviceCode: string[] expected";
            }
            if (message.billingClass != null && message.hasOwnProperty("billingClass")) {
                properties._billingClass = 1;
                if (!$util.isString(message.billingClass))
                    return "billingClass: string expected";
            }
            if (message.setting != null && message.hasOwnProperty("setting")) {
                properties._setting = 1;
                if (!$util.isString(message.setting))
                    return "setting: string expected";
            }
            if (message.billingCodeModifier != null && message.hasOwnProperty("billingCodeModifier")) {
                if (!Array.isArray(message.billingCodeModifier))
                    return "billingCodeModifier: array expected";
                for (var i = 0; i < message.billingCodeModifier.length; ++i)
                    if (!$util.isString(message.billingCodeModifier[i]))
                        return "billingCodeModifier: string[] expected";
            }
            if (message.additionalInformation != null && message.hasOwnProperty("additionalInformation")) {
                if (!Array.isArray(message.additionalInformation))
                    return "additionalInformation: array expected";
                for (var i = 0; i < message.additionalInformation.length; ++i)
                    if (!$util.isString(message.additionalInformation[i]))
                        return "additionalInformation: string[] expected";
            }
            return null;
        };

        /**
         * Creates a ProtoNegotiatedPriceKafkaMessage message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {provider.ProtoNegotiatedPriceKafkaMessage} ProtoNegotiatedPriceKafkaMessage
         */
        ProtoNegotiatedPriceKafkaMessage.fromObject = function fromObject(object) {
            if (object instanceof $root.provider.ProtoNegotiatedPriceKafkaMessage)
                return object;
            var message = new $root.provider.ProtoNegotiatedPriceKafkaMessage();
            if (object.negotiatedType != null)
                message.negotiatedType = String(object.negotiatedType);
            if (object.negotiatedRate != null)
                message.negotiatedRate = Number(object.negotiatedRate);
            if (object.expirationDate != null)
                message.expirationDate = String(object.expirationDate);
            if (object.serviceCode) {
                if (!Array.isArray(object.serviceCode))
                    throw TypeError(".provider.ProtoNegotiatedPriceKafkaMessage.serviceCode: array expected");
                message.serviceCode = [];
                for (var i = 0; i < object.serviceCode.length; ++i)
                    message.serviceCode[i] = String(object.serviceCode[i]);
            }
            if (object.billingClass != null)
                message.billingClass = String(object.billingClass);
            if (object.setting != null)
                message.setting = String(object.setting);
            if (object.billingCodeModifier) {
                if (!Array.isArray(object.billingCodeModifier))
                    throw TypeError(".provider.ProtoNegotiatedPriceKafkaMessage.billingCodeModifier: array expected");
                message.billingCodeModifier = [];
                for (var i = 0; i < object.billingCodeModifier.length; ++i)
                    message.billingCodeModifier[i] = String(object.billingCodeModifier[i]);
            }
            if (object.additionalInformation) {
                if (!Array.isArray(object.additionalInformation))
                    throw TypeError(".provider.ProtoNegotiatedPriceKafkaMessage.additionalInformation: array expected");
                message.additionalInformation = [];
                for (var i = 0; i < object.additionalInformation.length; ++i)
                    message.additionalInformation[i] = String(object.additionalInformation[i]);
            }
            return message;
        };

        /**
         * Creates a plain object from a ProtoNegotiatedPriceKafkaMessage message. Also converts values to other types if specified.
         * @function toObject
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @static
         * @param {provider.ProtoNegotiatedPriceKafkaMessage} message ProtoNegotiatedPriceKafkaMessage
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ProtoNegotiatedPriceKafkaMessage.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults) {
                object.serviceCode = [];
                object.billingCodeModifier = [];
                object.additionalInformation = [];
            }
            if (message.negotiatedType != null && message.hasOwnProperty("negotiatedType")) {
                object.negotiatedType = message.negotiatedType;
                if (options.oneofs)
                    object._negotiatedType = "negotiatedType";
            }
            if (message.negotiatedRate != null && message.hasOwnProperty("negotiatedRate")) {
                object.negotiatedRate = options.json && !isFinite(message.negotiatedRate) ? String(message.negotiatedRate) : message.negotiatedRate;
                if (options.oneofs)
                    object._negotiatedRate = "negotiatedRate";
            }
            if (message.expirationDate != null && message.hasOwnProperty("expirationDate")) {
                object.expirationDate = message.expirationDate;
                if (options.oneofs)
                    object._expirationDate = "expirationDate";
            }
            if (message.serviceCode && message.serviceCode.length) {
                object.serviceCode = [];
                for (var j = 0; j < message.serviceCode.length; ++j)
                    object.serviceCode[j] = message.serviceCode[j];
            }
            if (message.billingClass != null && message.hasOwnProperty("billingClass")) {
                object.billingClass = message.billingClass;
                if (options.oneofs)
                    object._billingClass = "billingClass";
            }
            if (message.setting != null && message.hasOwnProperty("setting")) {
                object.setting = message.setting;
                if (options.oneofs)
                    object._setting = "setting";
            }
            if (message.billingCodeModifier && message.billingCodeModifier.length) {
                object.billingCodeModifier = [];
                for (var j = 0; j < message.billingCodeModifier.length; ++j)
                    object.billingCodeModifier[j] = message.billingCodeModifier[j];
            }
            if (message.additionalInformation && message.additionalInformation.length) {
                object.additionalInformation = [];
                for (var j = 0; j < message.additionalInformation.length; ++j)
                    object.additionalInformation[j] = message.additionalInformation[j];
            }
            return object;
        };

        /**
         * Converts this ProtoNegotiatedPriceKafkaMessage to JSON.
         * @function toJSON
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ProtoNegotiatedPriceKafkaMessage.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ProtoNegotiatedPriceKafkaMessage
         * @function getTypeUrl
         * @memberof provider.ProtoNegotiatedPriceKafkaMessage
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ProtoNegotiatedPriceKafkaMessage.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/provider.ProtoNegotiatedPriceKafkaMessage";
        };

        return ProtoNegotiatedPriceKafkaMessage;
    })();

    provider.ProtoProcedureKafkaMessage = (function() {

        /**
         * Properties of a ProtoProcedureKafkaMessage.
         * @memberof provider
         * @interface IProtoProcedureKafkaMessage
         * @property {string|null} [negotiationArrangement] ProtoProcedureKafkaMessage negotiationArrangement
         * @property {string|null} [name] ProtoProcedureKafkaMessage name
         * @property {string|null} [billingCodeType] ProtoProcedureKafkaMessage billingCodeType
         * @property {string|null} [billingCodeTypeVersion] ProtoProcedureKafkaMessage billingCodeTypeVersion
         * @property {string|null} [billingCode] ProtoProcedureKafkaMessage billingCode
         * @property {string|null} [description] ProtoProcedureKafkaMessage description
         */

        /**
         * Constructs a new ProtoProcedureKafkaMessage.
         * @memberof provider
         * @classdesc Represents a ProtoProcedureKafkaMessage.
         * @implements IProtoProcedureKafkaMessage
         * @constructor
         * @param {provider.IProtoProcedureKafkaMessage=} [properties] Properties to set
         */
        function ProtoProcedureKafkaMessage(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * ProtoProcedureKafkaMessage negotiationArrangement.
         * @member {string} negotiationArrangement
         * @memberof provider.ProtoProcedureKafkaMessage
         * @instance
         */
        ProtoProcedureKafkaMessage.prototype.negotiationArrangement = "";

        /**
         * ProtoProcedureKafkaMessage name.
         * @member {string} name
         * @memberof provider.ProtoProcedureKafkaMessage
         * @instance
         */
        ProtoProcedureKafkaMessage.prototype.name = "";

        /**
         * ProtoProcedureKafkaMessage billingCodeType.
         * @member {string} billingCodeType
         * @memberof provider.ProtoProcedureKafkaMessage
         * @instance
         */
        ProtoProcedureKafkaMessage.prototype.billingCodeType = "";

        /**
         * ProtoProcedureKafkaMessage billingCodeTypeVersion.
         * @member {string} billingCodeTypeVersion
         * @memberof provider.ProtoProcedureKafkaMessage
         * @instance
         */
        ProtoProcedureKafkaMessage.prototype.billingCodeTypeVersion = "";

        /**
         * ProtoProcedureKafkaMessage billingCode.
         * @member {string} billingCode
         * @memberof provider.ProtoProcedureKafkaMessage
         * @instance
         */
        ProtoProcedureKafkaMessage.prototype.billingCode = "";

        /**
         * ProtoProcedureKafkaMessage description.
         * @member {string} description
         * @memberof provider.ProtoProcedureKafkaMessage
         * @instance
         */
        ProtoProcedureKafkaMessage.prototype.description = "";

        /**
         * Creates a new ProtoProcedureKafkaMessage instance using the specified properties.
         * @function create
         * @memberof provider.ProtoProcedureKafkaMessage
         * @static
         * @param {provider.IProtoProcedureKafkaMessage=} [properties] Properties to set
         * @returns {provider.ProtoProcedureKafkaMessage} ProtoProcedureKafkaMessage instance
         */
        ProtoProcedureKafkaMessage.create = function create(properties) {
            return new ProtoProcedureKafkaMessage(properties);
        };

        /**
         * Encodes the specified ProtoProcedureKafkaMessage message. Does not implicitly {@link provider.ProtoProcedureKafkaMessage.verify|verify} messages.
         * @function encode
         * @memberof provider.ProtoProcedureKafkaMessage
         * @static
         * @param {provider.IProtoProcedureKafkaMessage} message ProtoProcedureKafkaMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ProtoProcedureKafkaMessage.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.negotiationArrangement != null && Object.hasOwnProperty.call(message, "negotiationArrangement"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.negotiationArrangement);
            if (message.name != null && Object.hasOwnProperty.call(message, "name"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.name);
            if (message.billingCodeType != null && Object.hasOwnProperty.call(message, "billingCodeType"))
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.billingCodeType);
            if (message.billingCodeTypeVersion != null && Object.hasOwnProperty.call(message, "billingCodeTypeVersion"))
                writer.uint32(/* id 4, wireType 2 =*/34).string(message.billingCodeTypeVersion);
            if (message.billingCode != null && Object.hasOwnProperty.call(message, "billingCode"))
                writer.uint32(/* id 5, wireType 2 =*/42).string(message.billingCode);
            if (message.description != null && Object.hasOwnProperty.call(message, "description"))
                writer.uint32(/* id 6, wireType 2 =*/50).string(message.description);
            return writer;
        };

        /**
         * Encodes the specified ProtoProcedureKafkaMessage message, length delimited. Does not implicitly {@link provider.ProtoProcedureKafkaMessage.verify|verify} messages.
         * @function encodeDelimited
         * @memberof provider.ProtoProcedureKafkaMessage
         * @static
         * @param {provider.IProtoProcedureKafkaMessage} message ProtoProcedureKafkaMessage message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        ProtoProcedureKafkaMessage.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a ProtoProcedureKafkaMessage message from the specified reader or buffer.
         * @function decode
         * @memberof provider.ProtoProcedureKafkaMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {provider.ProtoProcedureKafkaMessage} ProtoProcedureKafkaMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ProtoProcedureKafkaMessage.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.provider.ProtoProcedureKafkaMessage();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.negotiationArrangement = reader.string();
                        break;
                    }
                case 2: {
                        message.name = reader.string();
                        break;
                    }
                case 3: {
                        message.billingCodeType = reader.string();
                        break;
                    }
                case 4: {
                        message.billingCodeTypeVersion = reader.string();
                        break;
                    }
                case 5: {
                        message.billingCode = reader.string();
                        break;
                    }
                case 6: {
                        message.description = reader.string();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a ProtoProcedureKafkaMessage message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof provider.ProtoProcedureKafkaMessage
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {provider.ProtoProcedureKafkaMessage} ProtoProcedureKafkaMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        ProtoProcedureKafkaMessage.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a ProtoProcedureKafkaMessage message.
         * @function verify
         * @memberof provider.ProtoProcedureKafkaMessage
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        ProtoProcedureKafkaMessage.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.negotiationArrangement != null && message.hasOwnProperty("negotiationArrangement"))
                if (!$util.isString(message.negotiationArrangement))
                    return "negotiationArrangement: string expected";
            if (message.name != null && message.hasOwnProperty("name"))
                if (!$util.isString(message.name))
                    return "name: string expected";
            if (message.billingCodeType != null && message.hasOwnProperty("billingCodeType"))
                if (!$util.isString(message.billingCodeType))
                    return "billingCodeType: string expected";
            if (message.billingCodeTypeVersion != null && message.hasOwnProperty("billingCodeTypeVersion"))
                if (!$util.isString(message.billingCodeTypeVersion))
                    return "billingCodeTypeVersion: string expected";
            if (message.billingCode != null && message.hasOwnProperty("billingCode"))
                if (!$util.isString(message.billingCode))
                    return "billingCode: string expected";
            if (message.description != null && message.hasOwnProperty("description"))
                if (!$util.isString(message.description))
                    return "description: string expected";
            return null;
        };

        /**
         * Creates a ProtoProcedureKafkaMessage message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof provider.ProtoProcedureKafkaMessage
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {provider.ProtoProcedureKafkaMessage} ProtoProcedureKafkaMessage
         */
        ProtoProcedureKafkaMessage.fromObject = function fromObject(object) {
            if (object instanceof $root.provider.ProtoProcedureKafkaMessage)
                return object;
            var message = new $root.provider.ProtoProcedureKafkaMessage();
            if (object.negotiationArrangement != null)
                message.negotiationArrangement = String(object.negotiationArrangement);
            if (object.name != null)
                message.name = String(object.name);
            if (object.billingCodeType != null)
                message.billingCodeType = String(object.billingCodeType);
            if (object.billingCodeTypeVersion != null)
                message.billingCodeTypeVersion = String(object.billingCodeTypeVersion);
            if (object.billingCode != null)
                message.billingCode = String(object.billingCode);
            if (object.description != null)
                message.description = String(object.description);
            return message;
        };

        /**
         * Creates a plain object from a ProtoProcedureKafkaMessage message. Also converts values to other types if specified.
         * @function toObject
         * @memberof provider.ProtoProcedureKafkaMessage
         * @static
         * @param {provider.ProtoProcedureKafkaMessage} message ProtoProcedureKafkaMessage
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        ProtoProcedureKafkaMessage.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.negotiationArrangement = "";
                object.name = "";
                object.billingCodeType = "";
                object.billingCodeTypeVersion = "";
                object.billingCode = "";
                object.description = "";
            }
            if (message.negotiationArrangement != null && message.hasOwnProperty("negotiationArrangement"))
                object.negotiationArrangement = message.negotiationArrangement;
            if (message.name != null && message.hasOwnProperty("name"))
                object.name = message.name;
            if (message.billingCodeType != null && message.hasOwnProperty("billingCodeType"))
                object.billingCodeType = message.billingCodeType;
            if (message.billingCodeTypeVersion != null && message.hasOwnProperty("billingCodeTypeVersion"))
                object.billingCodeTypeVersion = message.billingCodeTypeVersion;
            if (message.billingCode != null && message.hasOwnProperty("billingCode"))
                object.billingCode = message.billingCode;
            if (message.description != null && message.hasOwnProperty("description"))
                object.description = message.description;
            return object;
        };

        /**
         * Converts this ProtoProcedureKafkaMessage to JSON.
         * @function toJSON
         * @memberof provider.ProtoProcedureKafkaMessage
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        ProtoProcedureKafkaMessage.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for ProtoProcedureKafkaMessage
         * @function getTypeUrl
         * @memberof provider.ProtoProcedureKafkaMessage
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        ProtoProcedureKafkaMessage.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/provider.ProtoProcedureKafkaMessage";
        };

        return ProtoProcedureKafkaMessage;
    })();

    return provider;
})();

module.exports = $root;
