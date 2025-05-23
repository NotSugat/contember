import { useUploadState } from '../internal/hooks/useUploadState'
import { useUploaderDoUpload } from '../internal/hooks/useUploaderDoUpload'
import { UploaderOptionsContext, UploaderStateContext, UploaderUploadFilesContext } from '../contexts'
import { Fragment, ReactNode, useMemo } from 'react'
import { Component } from '@contember/react-binding'
import { FileType, UploaderBaseFieldProps } from '../types'
import { UploaderBase } from './UploaderBase'
import { uploaderErrorHandler } from '../internal/utils/uploaderErrorHandler'
import { useCreateRepeaterEntity } from '../internal/hooks/useCreateRepeaterEntity'
import { MultiUploaderEntityToFileStateMapContext } from '../internal/contexts'

export type MultiUploaderProps =
	& UploaderBaseFieldProps
	& {
		fileType: FileType
		children?: ReactNode
	}

const noop = () => Promise.resolve(undefined)

export const MultiUploader = Component<MultiUploaderProps>(({ baseField, fileType, children }) => {
	const { entityToFileId, ...fillEntityEvents } = useCreateRepeaterEntity({
		baseField,
		fileType,
		onError: uploaderErrorHandler,
		onStartUpload: noop,
		onBeforeUpload: noop,
		onProgress: noop,
		onAfterUpload: noop,
		onSuccess: noop,
	})
	const { files, ...stateEvents } = useUploadState(fillEntityEvents)
	const onDrop = useUploaderDoUpload(stateEvents)
	const options = useMemo(() => ({
		accept: fileType.accept,
		multiple: true,
	}), [fileType.accept])

	return (
		<UploaderStateContext.Provider value={files}>
			<UploaderUploadFilesContext.Provider value={onDrop}>
				<UploaderOptionsContext.Provider value={options}>
					<MultiUploaderEntityToFileStateMapContext.Provider value={entityToFileId}>
						{children}
					</MultiUploaderEntityToFileStateMapContext.Provider>
				</UploaderOptionsContext.Provider>
			</UploaderUploadFilesContext.Provider>
		</UploaderStateContext.Provider>
	)
}, ({ baseField, fileType, children }, environment) => {
	return (
		<UploaderBase baseField={baseField}>
			{fileType.extractors?.map((extractor, i) => <Fragment key={i}>{extractor.staticRender({ environment })}</Fragment>)}
			{children}
		</UploaderBase>
	)
})
