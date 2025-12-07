import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AttachmentStore, type AttachmentCreateParams } from "../store";
import type { Attachment } from "../types";

export interface AwsAttachmentStoreConfig {
  /**
   * S3 bucket name where attachments will be stored
   */
  bucket: string;

  /**
   * S3 region (e.g., "us-east-1")
   */
  region: string;

  /**
   * Optional S3 key prefix for all attachments (e.g., "attachments/")
   * Defaults to empty string
   */
  keyPrefix?: string;

  /**
   * Optional AWS credentials. If not provided, will use default credential chain
   * (environment variables, IAM role, etc.)
   */
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };

  /**
   * Optional custom S3 endpoint URL (for S3-compatible services like MinIO)
   */
  endpoint?: string;

  /**
   * Optional base URL for generating preview URLs.
   * If not provided, will generate presigned URLs for preview
   */
  baseUrl?: string;

  /**
   * Expiration time in seconds for presigned URLs (default: 3600 = 1 hour)
   */
  urlExpirationSeconds?: number;
}

/**
 * AWS S3-based AttachmentStore that stores files in an S3 bucket.
 * Supports presigned URLs for secure uploads and downloads.
 */
export class AwsAttachmentStore<TContext = unknown> extends AttachmentStore<TContext> {
  private s3Client: S3Client;
  private bucket: string;
  private keyPrefix: string;
  private baseUrl?: string;
  private urlExpirationSeconds: number;

  constructor(config: AwsAttachmentStoreConfig) {
    super();
    this.bucket = config.bucket;
    this.keyPrefix = config.keyPrefix || "";
    this.baseUrl = config.baseUrl;
    this.urlExpirationSeconds = config.urlExpirationSeconds || 3600;

    const clientConfig: any = {
      region: config.region,
    };

    if (config.credentials) {
      clientConfig.credentials = config.credentials;
    }

    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
      clientConfig.forcePathStyle = true; // Required for S3-compatible services
    }

    this.s3Client = new S3Client(clientConfig);
  }

  /**
   * Get the S3 key for an attachment ID.
   */
  private getS3Key(attachmentId: string): string {
    return this.keyPrefix ? `${this.keyPrefix}${attachmentId}` : attachmentId;
  }

  /**
   * Generate a presigned URL for uploading to S3.
   */
  private async generateUploadUrl(
    attachmentId: string,
    mimeType: string
  ): Promise<string> {
    const key = this.getS3Key(attachmentId);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });

    return await getSignedUrl(this.s3Client, command, {
      expiresIn: this.urlExpirationSeconds,
    });
  }

  /**
   * Generate a presigned URL for downloading from S3.
   */
  private async generateDownloadUrl(attachmentId: string): Promise<string> {
    const key = this.getS3Key(attachmentId);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, {
      expiresIn: this.urlExpirationSeconds,
    });
  }

  /**
   * Get a public or presigned URL for the file (for download/preview).
   */
  private async getFileUrl(attachmentId: string): Promise<string> {
    if (this.baseUrl) {
      // Use base URL if configured (assumes public access or custom CDN)
      const key = this.getS3Key(attachmentId);
      return `${this.baseUrl}/${key}`;
    }
    // Otherwise, generate a presigned URL
    return await this.generateDownloadUrl(attachmentId);
  }

  override async createAttachment(
    input: AttachmentCreateParams,
    context: TContext
  ): Promise<Attachment> {
    const attachmentId = this.generateAttachmentId(input.mime_type, context);
    const isImage = input.mime_type?.startsWith("image/");

    // Generate presigned upload URL
    const uploadUrl = await this.generateUploadUrl(attachmentId, input.mime_type);

    // Generate preview URL if it's an image
    const previewUrl = isImage ? await this.getFileUrl(attachmentId) : null;

    const attachment: Attachment = {
      id: attachmentId,
      name: input.name,
      mime_type: input.mime_type,
      type: isImage ? "image" : "file",
      upload_url: uploadUrl,
      preview_url: previewUrl,
    };

    return attachment;
  }

  async deleteAttachment(
    attachmentId: string,
    _context: TContext
  ): Promise<void> {
    const key = this.getS3Key(attachmentId);
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.s3Client.send(command);
    } catch (error: any) {
      // Log but don't throw - deletion is idempotent
      console.warn(`Failed to delete attachment ${attachmentId} from S3:`, error);
    }
  }

  /**
   * Store file data to S3 (called by the upload endpoint after receiving the file).
   * This method can be used if you want to handle the upload server-side.
   */
  async storeFileData(
    attachmentId: string,
    data: Uint8Array | Buffer,
    mimeType?: string
  ): Promise<void> {
    const key = this.getS3Key(attachmentId);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: mimeType,
    });

    await this.s3Client.send(command);
  }

  /**
   * Check if an attachment exists in S3.
   */
  async attachmentExists(attachmentId: string): Promise<boolean> {
    const key = this.getS3Key(attachmentId);
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file data from S3 as a stream or buffer.
   */
  async getFileData(attachmentId: string): Promise<Uint8Array | null> {
    const key = this.getS3Key(attachmentId);
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        return null;
      }

      // Convert the stream to Uint8Array
      const chunks: Uint8Array[] = [];
      const stream = response.Body as any;
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      // Combine all chunks into a single Uint8Array
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      
      return result;
    } catch (error: any) {
      if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      console.error(`Failed to read attachment ${attachmentId} from S3:`, error);
      return null;
    }
  }
}

