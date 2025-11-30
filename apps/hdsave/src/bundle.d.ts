import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace provider. */
export namespace provider {

    /** Properties of a ProtoProviderNegotiationKafkaMessage. */
    interface IProtoProviderNegotiationKafkaMessage {

        /** ProtoProviderNegotiationKafkaMessage procedure */
        procedure?: (provider.IProtoProcedureKafkaMessage|null);

        /** ProtoProviderNegotiationKafkaMessage providerGroup */
        providerGroup?: (provider.IProtoProviderMessage[]|null);

        /** ProtoProviderNegotiationKafkaMessage negotiatedPrices */
        negotiatedPrices?: (provider.IProtoNegotiatedPriceKafkaMessage[]|null);
    }

    /** Represents a ProtoProviderNegotiationKafkaMessage. */
    class ProtoProviderNegotiationKafkaMessage implements IProtoProviderNegotiationKafkaMessage {

        /**
         * Constructs a new ProtoProviderNegotiationKafkaMessage.
         * @param [properties] Properties to set
         */
        constructor(properties?: provider.IProtoProviderNegotiationKafkaMessage);

        /** ProtoProviderNegotiationKafkaMessage procedure. */
        public procedure?: (provider.IProtoProcedureKafkaMessage|null);

        /** ProtoProviderNegotiationKafkaMessage providerGroup. */
        public providerGroup: provider.IProtoProviderMessage[];

        /** ProtoProviderNegotiationKafkaMessage negotiatedPrices. */
        public negotiatedPrices: provider.IProtoNegotiatedPriceKafkaMessage[];

        /**
         * Creates a new ProtoProviderNegotiationKafkaMessage instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ProtoProviderNegotiationKafkaMessage instance
         */
        public static create(properties?: provider.IProtoProviderNegotiationKafkaMessage): provider.ProtoProviderNegotiationKafkaMessage;

        /**
         * Encodes the specified ProtoProviderNegotiationKafkaMessage message. Does not implicitly {@link provider.ProtoProviderNegotiationKafkaMessage.verify|verify} messages.
         * @param message ProtoProviderNegotiationKafkaMessage message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: provider.IProtoProviderNegotiationKafkaMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ProtoProviderNegotiationKafkaMessage message, length delimited. Does not implicitly {@link provider.ProtoProviderNegotiationKafkaMessage.verify|verify} messages.
         * @param message ProtoProviderNegotiationKafkaMessage message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: provider.IProtoProviderNegotiationKafkaMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ProtoProviderNegotiationKafkaMessage message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ProtoProviderNegotiationKafkaMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): provider.ProtoProviderNegotiationKafkaMessage;

        /**
         * Decodes a ProtoProviderNegotiationKafkaMessage message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ProtoProviderNegotiationKafkaMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): provider.ProtoProviderNegotiationKafkaMessage;

        /**
         * Verifies a ProtoProviderNegotiationKafkaMessage message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a ProtoProviderNegotiationKafkaMessage message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ProtoProviderNegotiationKafkaMessage
         */
        public static fromObject(object: { [k: string]: any }): provider.ProtoProviderNegotiationKafkaMessage;

        /**
         * Creates a plain object from a ProtoProviderNegotiationKafkaMessage message. Also converts values to other types if specified.
         * @param message ProtoProviderNegotiationKafkaMessage
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: provider.ProtoProviderNegotiationKafkaMessage, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ProtoProviderNegotiationKafkaMessage to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ProtoProviderNegotiationKafkaMessage
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ProtoProviderMessage. */
    interface IProtoProviderMessage {

        /** ProtoProviderMessage networkName */
        networkName?: (string[]|null);

        /** ProtoProviderMessage providerGroups */
        providerGroups?: (provider.IProtoProviderObject[]|null);
    }

    /** Represents a ProtoProviderMessage. */
    class ProtoProviderMessage implements IProtoProviderMessage {

        /**
         * Constructs a new ProtoProviderMessage.
         * @param [properties] Properties to set
         */
        constructor(properties?: provider.IProtoProviderMessage);

        /** ProtoProviderMessage networkName. */
        public networkName: string[];

        /** ProtoProviderMessage providerGroups. */
        public providerGroups: provider.IProtoProviderObject[];

        /**
         * Creates a new ProtoProviderMessage instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ProtoProviderMessage instance
         */
        public static create(properties?: provider.IProtoProviderMessage): provider.ProtoProviderMessage;

        /**
         * Encodes the specified ProtoProviderMessage message. Does not implicitly {@link provider.ProtoProviderMessage.verify|verify} messages.
         * @param message ProtoProviderMessage message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: provider.IProtoProviderMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ProtoProviderMessage message, length delimited. Does not implicitly {@link provider.ProtoProviderMessage.verify|verify} messages.
         * @param message ProtoProviderMessage message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: provider.IProtoProviderMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ProtoProviderMessage message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ProtoProviderMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): provider.ProtoProviderMessage;

        /**
         * Decodes a ProtoProviderMessage message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ProtoProviderMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): provider.ProtoProviderMessage;

        /**
         * Verifies a ProtoProviderMessage message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a ProtoProviderMessage message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ProtoProviderMessage
         */
        public static fromObject(object: { [k: string]: any }): provider.ProtoProviderMessage;

        /**
         * Creates a plain object from a ProtoProviderMessage message. Also converts values to other types if specified.
         * @param message ProtoProviderMessage
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: provider.ProtoProviderMessage, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ProtoProviderMessage to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ProtoProviderMessage
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ProtoProviderObject. */
    interface IProtoProviderObject {

        /** ProtoProviderObject npi */
        npi?: (string[]|null);

        /** ProtoProviderObject tin */
        tin?: (provider.IProtoTaxIdentifier|null);
    }

    /** Represents a ProtoProviderObject. */
    class ProtoProviderObject implements IProtoProviderObject {

        /**
         * Constructs a new ProtoProviderObject.
         * @param [properties] Properties to set
         */
        constructor(properties?: provider.IProtoProviderObject);

        /** ProtoProviderObject npi. */
        public npi: string[];

        /** ProtoProviderObject tin. */
        public tin?: (provider.IProtoTaxIdentifier|null);

        /**
         * Creates a new ProtoProviderObject instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ProtoProviderObject instance
         */
        public static create(properties?: provider.IProtoProviderObject): provider.ProtoProviderObject;

        /**
         * Encodes the specified ProtoProviderObject message. Does not implicitly {@link provider.ProtoProviderObject.verify|verify} messages.
         * @param message ProtoProviderObject message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: provider.IProtoProviderObject, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ProtoProviderObject message, length delimited. Does not implicitly {@link provider.ProtoProviderObject.verify|verify} messages.
         * @param message ProtoProviderObject message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: provider.IProtoProviderObject, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ProtoProviderObject message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ProtoProviderObject
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): provider.ProtoProviderObject;

        /**
         * Decodes a ProtoProviderObject message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ProtoProviderObject
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): provider.ProtoProviderObject;

        /**
         * Verifies a ProtoProviderObject message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a ProtoProviderObject message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ProtoProviderObject
         */
        public static fromObject(object: { [k: string]: any }): provider.ProtoProviderObject;

        /**
         * Creates a plain object from a ProtoProviderObject message. Also converts values to other types if specified.
         * @param message ProtoProviderObject
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: provider.ProtoProviderObject, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ProtoProviderObject to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ProtoProviderObject
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ProtoTaxIdentifier. */
    interface IProtoTaxIdentifier {

        /** ProtoTaxIdentifier type */
        type?: (string|null);

        /** ProtoTaxIdentifier value */
        value?: (string|null);

        /** ProtoTaxIdentifier businessName */
        businessName?: (string|null);
    }

    /** Represents a ProtoTaxIdentifier. */
    class ProtoTaxIdentifier implements IProtoTaxIdentifier {

        /**
         * Constructs a new ProtoTaxIdentifier.
         * @param [properties] Properties to set
         */
        constructor(properties?: provider.IProtoTaxIdentifier);

        /** ProtoTaxIdentifier type. */
        public type: string;

        /** ProtoTaxIdentifier value. */
        public value: string;

        /** ProtoTaxIdentifier businessName. */
        public businessName: string;

        /**
         * Creates a new ProtoTaxIdentifier instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ProtoTaxIdentifier instance
         */
        public static create(properties?: provider.IProtoTaxIdentifier): provider.ProtoTaxIdentifier;

        /**
         * Encodes the specified ProtoTaxIdentifier message. Does not implicitly {@link provider.ProtoTaxIdentifier.verify|verify} messages.
         * @param message ProtoTaxIdentifier message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: provider.IProtoTaxIdentifier, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ProtoTaxIdentifier message, length delimited. Does not implicitly {@link provider.ProtoTaxIdentifier.verify|verify} messages.
         * @param message ProtoTaxIdentifier message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: provider.IProtoTaxIdentifier, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ProtoTaxIdentifier message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ProtoTaxIdentifier
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): provider.ProtoTaxIdentifier;

        /**
         * Decodes a ProtoTaxIdentifier message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ProtoTaxIdentifier
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): provider.ProtoTaxIdentifier;

        /**
         * Verifies a ProtoTaxIdentifier message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a ProtoTaxIdentifier message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ProtoTaxIdentifier
         */
        public static fromObject(object: { [k: string]: any }): provider.ProtoTaxIdentifier;

        /**
         * Creates a plain object from a ProtoTaxIdentifier message. Also converts values to other types if specified.
         * @param message ProtoTaxIdentifier
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: provider.ProtoTaxIdentifier, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ProtoTaxIdentifier to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ProtoTaxIdentifier
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ProtoNegotiatedPriceKafkaMessage. */
    interface IProtoNegotiatedPriceKafkaMessage {

        /** ProtoNegotiatedPriceKafkaMessage negotiatedType */
        negotiatedType?: (string|null);

        /** ProtoNegotiatedPriceKafkaMessage negotiatedRate */
        negotiatedRate?: (number|null);

        /** ProtoNegotiatedPriceKafkaMessage expirationDate */
        expirationDate?: (string|null);

        /** ProtoNegotiatedPriceKafkaMessage serviceCode */
        serviceCode?: (string[]|null);

        /** ProtoNegotiatedPriceKafkaMessage billingClass */
        billingClass?: (string|null);

        /** ProtoNegotiatedPriceKafkaMessage setting */
        setting?: (string|null);

        /** ProtoNegotiatedPriceKafkaMessage billingCodeModifier */
        billingCodeModifier?: (string[]|null);

        /** ProtoNegotiatedPriceKafkaMessage additionalInformation */
        additionalInformation?: (string[]|null);
    }

    /** Represents a ProtoNegotiatedPriceKafkaMessage. */
    class ProtoNegotiatedPriceKafkaMessage implements IProtoNegotiatedPriceKafkaMessage {

        /**
         * Constructs a new ProtoNegotiatedPriceKafkaMessage.
         * @param [properties] Properties to set
         */
        constructor(properties?: provider.IProtoNegotiatedPriceKafkaMessage);

        /** ProtoNegotiatedPriceKafkaMessage negotiatedType. */
        public negotiatedType?: (string|null);

        /** ProtoNegotiatedPriceKafkaMessage negotiatedRate. */
        public negotiatedRate?: (number|null);

        /** ProtoNegotiatedPriceKafkaMessage expirationDate. */
        public expirationDate?: (string|null);

        /** ProtoNegotiatedPriceKafkaMessage serviceCode. */
        public serviceCode: string[];

        /** ProtoNegotiatedPriceKafkaMessage billingClass. */
        public billingClass?: (string|null);

        /** ProtoNegotiatedPriceKafkaMessage setting. */
        public setting?: (string|null);

        /** ProtoNegotiatedPriceKafkaMessage billingCodeModifier. */
        public billingCodeModifier: string[];

        /** ProtoNegotiatedPriceKafkaMessage additionalInformation. */
        public additionalInformation: string[];

        /** ProtoNegotiatedPriceKafkaMessage _negotiatedType. */
        public _negotiatedType?: "negotiatedType";

        /** ProtoNegotiatedPriceKafkaMessage _negotiatedRate. */
        public _negotiatedRate?: "negotiatedRate";

        /** ProtoNegotiatedPriceKafkaMessage _expirationDate. */
        public _expirationDate?: "expirationDate";

        /** ProtoNegotiatedPriceKafkaMessage _billingClass. */
        public _billingClass?: "billingClass";

        /** ProtoNegotiatedPriceKafkaMessage _setting. */
        public _setting?: "setting";

        /**
         * Creates a new ProtoNegotiatedPriceKafkaMessage instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ProtoNegotiatedPriceKafkaMessage instance
         */
        public static create(properties?: provider.IProtoNegotiatedPriceKafkaMessage): provider.ProtoNegotiatedPriceKafkaMessage;

        /**
         * Encodes the specified ProtoNegotiatedPriceKafkaMessage message. Does not implicitly {@link provider.ProtoNegotiatedPriceKafkaMessage.verify|verify} messages.
         * @param message ProtoNegotiatedPriceKafkaMessage message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: provider.IProtoNegotiatedPriceKafkaMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ProtoNegotiatedPriceKafkaMessage message, length delimited. Does not implicitly {@link provider.ProtoNegotiatedPriceKafkaMessage.verify|verify} messages.
         * @param message ProtoNegotiatedPriceKafkaMessage message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: provider.IProtoNegotiatedPriceKafkaMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ProtoNegotiatedPriceKafkaMessage message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ProtoNegotiatedPriceKafkaMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): provider.ProtoNegotiatedPriceKafkaMessage;

        /**
         * Decodes a ProtoNegotiatedPriceKafkaMessage message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ProtoNegotiatedPriceKafkaMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): provider.ProtoNegotiatedPriceKafkaMessage;

        /**
         * Verifies a ProtoNegotiatedPriceKafkaMessage message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a ProtoNegotiatedPriceKafkaMessage message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ProtoNegotiatedPriceKafkaMessage
         */
        public static fromObject(object: { [k: string]: any }): provider.ProtoNegotiatedPriceKafkaMessage;

        /**
         * Creates a plain object from a ProtoNegotiatedPriceKafkaMessage message. Also converts values to other types if specified.
         * @param message ProtoNegotiatedPriceKafkaMessage
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: provider.ProtoNegotiatedPriceKafkaMessage, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ProtoNegotiatedPriceKafkaMessage to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ProtoNegotiatedPriceKafkaMessage
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a ProtoProcedureKafkaMessage. */
    interface IProtoProcedureKafkaMessage {

        /** ProtoProcedureKafkaMessage negotiationArrangement */
        negotiationArrangement?: (string|null);

        /** ProtoProcedureKafkaMessage name */
        name?: (string|null);

        /** ProtoProcedureKafkaMessage billingCodeType */
        billingCodeType?: (string|null);

        /** ProtoProcedureKafkaMessage billingCodeTypeVersion */
        billingCodeTypeVersion?: (string|null);

        /** ProtoProcedureKafkaMessage billingCode */
        billingCode?: (string|null);

        /** ProtoProcedureKafkaMessage description */
        description?: (string|null);
    }

    /** Represents a ProtoProcedureKafkaMessage. */
    class ProtoProcedureKafkaMessage implements IProtoProcedureKafkaMessage {

        /**
         * Constructs a new ProtoProcedureKafkaMessage.
         * @param [properties] Properties to set
         */
        constructor(properties?: provider.IProtoProcedureKafkaMessage);

        /** ProtoProcedureKafkaMessage negotiationArrangement. */
        public negotiationArrangement: string;

        /** ProtoProcedureKafkaMessage name. */
        public name: string;

        /** ProtoProcedureKafkaMessage billingCodeType. */
        public billingCodeType: string;

        /** ProtoProcedureKafkaMessage billingCodeTypeVersion. */
        public billingCodeTypeVersion: string;

        /** ProtoProcedureKafkaMessage billingCode. */
        public billingCode: string;

        /** ProtoProcedureKafkaMessage description. */
        public description: string;

        /**
         * Creates a new ProtoProcedureKafkaMessage instance using the specified properties.
         * @param [properties] Properties to set
         * @returns ProtoProcedureKafkaMessage instance
         */
        public static create(properties?: provider.IProtoProcedureKafkaMessage): provider.ProtoProcedureKafkaMessage;

        /**
         * Encodes the specified ProtoProcedureKafkaMessage message. Does not implicitly {@link provider.ProtoProcedureKafkaMessage.verify|verify} messages.
         * @param message ProtoProcedureKafkaMessage message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: provider.IProtoProcedureKafkaMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified ProtoProcedureKafkaMessage message, length delimited. Does not implicitly {@link provider.ProtoProcedureKafkaMessage.verify|verify} messages.
         * @param message ProtoProcedureKafkaMessage message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: provider.IProtoProcedureKafkaMessage, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a ProtoProcedureKafkaMessage message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns ProtoProcedureKafkaMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): provider.ProtoProcedureKafkaMessage;

        /**
         * Decodes a ProtoProcedureKafkaMessage message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns ProtoProcedureKafkaMessage
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): provider.ProtoProcedureKafkaMessage;

        /**
         * Verifies a ProtoProcedureKafkaMessage message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a ProtoProcedureKafkaMessage message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns ProtoProcedureKafkaMessage
         */
        public static fromObject(object: { [k: string]: any }): provider.ProtoProcedureKafkaMessage;

        /**
         * Creates a plain object from a ProtoProcedureKafkaMessage message. Also converts values to other types if specified.
         * @param message ProtoProcedureKafkaMessage
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: provider.ProtoProcedureKafkaMessage, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this ProtoProcedureKafkaMessage to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for ProtoProcedureKafkaMessage
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}
