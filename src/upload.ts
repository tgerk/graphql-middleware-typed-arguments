import { GraphQLUpload } from 'graphql-upload'
import { processTypeArgs } from './index'
import { IMiddlewareFunction } from 'graphql-middleware'

// this object shape is defined by Apollo Upload Server v5.0.0
export interface IUploadFile {
  stream
  filename
  mimetype
  encoding
}

declare type IUploadHandler<T> = (upload: IUploadFile) => Promise<T>

export interface IUploadConfig<T> {
  uploadHandler: IUploadHandler<T>
}

export function upload<T>({
  uploadHandler,
}: IUploadConfig<T>): IMiddlewareFunction {
  return processTypeArgs({ type: GraphQLUpload, transform: uploadHandler })
}
