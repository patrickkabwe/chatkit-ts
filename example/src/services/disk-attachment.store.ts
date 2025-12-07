import { mkdir, writeFile, readFile, unlink, access, constants } from "fs/promises";
import { join } from "path";
import { AttachmentStore, type AttachmentCreateParams } from "../../../src/store";
import type { Attachment } from "../../../src/types";

/**
 * Disk-based AttachmentStore that stores files on the filesystem.
 * Files are stored in a configurable directory (defaults to ./attachments).
 */
export class DiskAttachmentStore<TContext = unknown> extends AttachmentStore<TContext> {
  private baseDir: string;

  constructor(baseDir: string = "./attachments") {
    super();
    this.baseDir = baseDir;
  }

  /**
   * Ensure the base directory exists, creating it if necessary.
   */
  private async ensureDirectory(): Promise<void> {
    try {
      await mkdir(this.baseDir, { recursive: true });
    } catch (error: any) {
      if (error.code !== "EEXIST") {
        throw error;
      }
    }
  }

  /**
   * Get the file path for an attachment ID.
   */
  private getFilePath(attachmentId: string): string {
    return join(this.baseDir, `${attachmentId}`);
  }

  override async createAttachment(
    input: AttachmentCreateParams,
    _context: TContext
  ): Promise<Attachment> {
    await this.ensureDirectory();

    const attachmentId = this.generateAttachmentId(input.mime_type, _context);

    // Generate upload URL for two-phase upload
    const baseUrl = process.env.BASE_URL || "https://f9828d7d6184.ngrok-free.app";
    const upload_url = `${baseUrl}/api/chatkit/attachments/${attachmentId}/upload`;
    const isImage = input.mime_type?.startsWith("image/");

    const attachment: Attachment = {
      id: attachmentId,
      name: input.name,
      mime_type: input.mime_type,
      type: isImage ? "image" : "file",
      upload_url,
      preview_url: isImage ? this.getFileUrl(attachmentId) : null
    };

    return attachment;
  }

  async deleteAttachment(attachmentId: string, _context: TContext): Promise<void> {
    const filePath = this.getFilePath(attachmentId);
    try {
      await access(filePath, constants.F_OK);
      await unlink(filePath);
    } catch (error: any) {
      // Ignore errors if file doesn't exist (ENOENT)
      if (error.code !== "ENOENT") {
        console.warn(`Failed to delete attachment file ${attachmentId}:`, error);
      }
    }
  }

  /**
   * Store file data to disk (called by the upload endpoint).
   */
  async storeFileData(attachmentId: string, data: Uint8Array): Promise<void> {
    await this.ensureDirectory();
    const filePath = this.getFilePath(attachmentId);
    await writeFile(filePath, data);
  }

  /**
   * Retrieve file data from disk.
   */
  async getFileData(attachmentId: string): Promise<Bun.BunFile | null> {
    try {
      const filePath = this.getFilePath(attachmentId);
      const file = await Bun.file(filePath)
      return file
    } catch (error: any) {
      // Return null if file doesn't exist
      if (error.code === "ENOENT") {
        return null;
      }
      console.error(`Failed to read attachment file ${attachmentId}:`, error);
      return null;
    }
  }

  /**
   * Get a URL to serve the file (for download/preview).
   */
  getFileUrl(attachmentId: string): string {
    const baseUrl = process.env.BASE_URL || "https://f9828d7d6184.ngrok-free.app";
    return `${baseUrl}/api/chatkit/attachments/${attachmentId}/file`;
  }
}
