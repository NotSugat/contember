import { Title } from '~/app/components/title'
import { Binding, PersistButton } from '~/lib/binding'
import { Slots } from '~/lib/layout'
import { Component, EntitySubTree, HasOne, useEntity, useField } from '@contember/interface'
import { Toggle } from '~/lib/ui/toggle'
import {
	AlignCenterIcon,
	AlignJustifyIcon,
	AlignLeftIcon,
	AlignRightIcon,
	BoldIcon,
	CodeIcon,
	Heading1Icon,
	Heading2Icon,
	Heading3Icon,
	HighlighterIcon,
	ImageIcon,
	ItalicIcon,
	Link2Icon,
	LinkIcon,
	ListIcon,
	ListOrderedIcon,
	LocateIcon,
	MinusIcon, PencilIcon,
	PilcrowIcon,
	QuoteIcon,
	StrikethroughIcon,
	TableIcon,
	TrashIcon,
	UnderlineIcon,
} from 'lucide-react'
import {
	anchorElementType,
	boldMark,
	codeMark,
	createAlignHandler,
	EditorElementTrigger,
	EditorGenericTrigger,
	EditorInlineReferencePortal,
	EditorMarkTrigger,
	EditorReferenceTrigger,
	EditorRenderElementProps,
	EditorTransforms,
	EditorWrapNodeTrigger,
	headingElementType,
	highlightMark,
	horizontalRuleElementType,
	italicMark,
	orderedListElementType,
	paragraphElementType,
	scrollTargetElementType,
	strikeThroughMark,
	tableElementType,
	underlineMark,
	unorderedListElementType,
} from '@contember/react-slate-editor'
import { ImageField, InputField } from '~/lib/form'
import { Popover, PopoverContent, PopoverTrigger } from '~/lib/ui/popover'
import { Button } from '~/lib/ui/button'
import { PopoverClose } from '@radix-ui/react-popover'
import { uic } from '~/lib/utils'
import { useSlateStatic } from 'slate-react'
import {
	BlockEditorField,
	EditorBlock,
	EditorBlockContent,
	EditorBlockToolbar,
	EditorInlineToolbar,
	RichTextField,
	RichTextView,
} from '~/lib/editor'

export const Richtext = () => (
	<Binding>
		<Slots.Title>
			<Title icon={<PencilIcon />}>Rich text field</Title>
		</Slots.Title>

		<Slots.Actions>
			<PersistButton />
		</Slots.Actions>

		<EntitySubTree entity="EditorTextArea(unique = unique)" setOnCreate="(unique = unique)">
			<div className="space-y-4">
				<div className="max-w-md">
					<RichTextField field="data" label="Rich text field">
						<EditorInlineToolbar>
							<EditorMarkTrigger mark={boldMark}><Toggle><BoldIcon className="h-3 w-3" /></Toggle></EditorMarkTrigger>
							<EditorMarkTrigger mark={italicMark}><Toggle><ItalicIcon className="h-3 w-3" /></Toggle></EditorMarkTrigger>
							<EditorMarkTrigger mark={underlineMark}><Toggle><UnderlineIcon className="h-3 w-3" /></Toggle></EditorMarkTrigger>
							<EditorElementTrigger elementType={anchorElementType}><Toggle><LinkIcon className="h-3 w-3" /></Toggle></EditorElementTrigger>
							<EditorGenericTrigger {...createAlignHandler('start')}><Toggle><AlignLeftIcon className="h-3 w-3" /></Toggle></EditorGenericTrigger>
							<EditorGenericTrigger {...createAlignHandler('end')}><Toggle><AlignRightIcon className="h-3 w-3" /></Toggle></EditorGenericTrigger>
							<EditorGenericTrigger {...createAlignHandler('center')}><Toggle><AlignCenterIcon className="h-3 w-3" /></Toggle></EditorGenericTrigger>
						</EditorInlineToolbar>
					</RichTextField>
				</div>
				<h3>Preview</h3>
				<RichTextView field="data" />
			</div>
		</EntitySubTree>
	</Binding>
)

const BlockButton = uic('button', {
	baseClass: 'bg-white p-2 inline-flex flex-col hover:bg-gray-100 border border-gray-200 rounded-md w-32 items-center justify-center',
})

export const Blocks = () => (
	<Binding>
		<Slots.Title>
			<Title icon={<PencilIcon />}>Block editor</Title>
		</Slots.Title>

		<Slots.Actions>
			<PersistButton />
		</Slots.Actions>

		<EntitySubTree entity="EditorContent(unique = unique)" setOnCreate="(unique = unique)">
			<div className="space-y-4">
				<BlockEditorField
					field="data"
					referencesField="references"
					referenceDiscriminationField="type"
					plugins={[
						editor => {
							editor.registerElement({
								type: 'link',
								isInline: true,
								render: LinkElement,
							})
						},
					]}
				>
					<EditorBlockToolbar>
						<EditorReferenceTrigger referenceType="quote"><BlockButton><QuoteIcon /> Quote</BlockButton></EditorReferenceTrigger>
						<EditorReferenceTrigger referenceType="image"><BlockButton><ImageIcon /> Image</BlockButton></EditorReferenceTrigger>
						<EditorElementTrigger elementType={tableElementType}><BlockButton><TableIcon /> Table</BlockButton></EditorElementTrigger>
						<EditorElementTrigger elementType={scrollTargetElementType}><BlockButton><LocateIcon /> Scroll target</BlockButton></EditorElementTrigger>
						<EditorElementTrigger elementType={horizontalRuleElementType}><BlockButton><MinusIcon  /> Horizontal rule</BlockButton></EditorElementTrigger>
					</EditorBlockToolbar>
					<EditorInlineToolbar>
						<div>
							<EditorMarkTrigger mark={boldMark}><Toggle><BoldIcon className="h-3 w-3" /></Toggle></EditorMarkTrigger>
							<EditorMarkTrigger mark={italicMark}><Toggle><ItalicIcon className="h-3 w-3" /></Toggle></EditorMarkTrigger>
							<EditorMarkTrigger mark={underlineMark}><Toggle><UnderlineIcon className="h-3 w-3" /></Toggle></EditorMarkTrigger>
							<EditorMarkTrigger mark={strikeThroughMark}><Toggle><StrikethroughIcon className="h-3 w-3" /></Toggle></EditorMarkTrigger>
							<EditorMarkTrigger mark={highlightMark}><Toggle><HighlighterIcon className="h-3 w-3" /></Toggle></EditorMarkTrigger>
							<EditorMarkTrigger mark={codeMark}><Toggle><CodeIcon className="h-3 w-3" /></Toggle></EditorMarkTrigger>
							<EditorElementTrigger elementType={anchorElementType}><Toggle><Link2Icon className="h-3 w-3" /></Toggle></EditorElementTrigger>
							<Popover>
								<PopoverTrigger asChild>
									<Toggle><LinkIcon className="h-3 w-3" /></Toggle>
								</PopoverTrigger>
								<PopoverContent>
									<EditorInlineReferencePortal referenceType="link">
										<LinkField field="link" />
										<ConfirmReferenceButton />
									</EditorInlineReferencePortal>
								</PopoverContent>
							</Popover>
						</div>
						<div>
							<EditorElementTrigger elementType={paragraphElementType} suchThat={{ isNumbered: false }}><Toggle><PilcrowIcon className="h-3 w-3" /></Toggle></EditorElementTrigger>
							<EditorElementTrigger elementType={headingElementType} suchThat={{ level: 1, isNumbered: false }}><Toggle><Heading1Icon className="h-3 w-3" /></Toggle></EditorElementTrigger>
							<EditorElementTrigger elementType={headingElementType} suchThat={{ level: 2, isNumbered: false }}><Toggle><Heading2Icon className="h-3 w-3" /></Toggle></EditorElementTrigger>
							<EditorElementTrigger elementType={headingElementType} suchThat={{ level: 3, isNumbered: false }}><Toggle><Heading3Icon className="h-3 w-3" /></Toggle></EditorElementTrigger>
							<EditorElementTrigger elementType={unorderedListElementType}><Toggle><ListIcon className="h-3 w-3" /></Toggle></EditorElementTrigger>
							<EditorElementTrigger elementType={orderedListElementType}><Toggle><ListOrderedIcon className="h-3 w-3" /></Toggle></EditorElementTrigger>

							<EditorGenericTrigger {...createAlignHandler('start')}><Toggle className="ml-4"><AlignLeftIcon className="h-3 w-3" /></Toggle></EditorGenericTrigger>
							<EditorGenericTrigger {...createAlignHandler('end')}><Toggle><AlignRightIcon className="h-3 w-3" /></Toggle></EditorGenericTrigger>
							<EditorGenericTrigger {...createAlignHandler('center')}><Toggle><AlignCenterIcon className="h-3 w-3" /></Toggle></EditorGenericTrigger>
							<EditorGenericTrigger {...createAlignHandler('justify')}><Toggle><AlignJustifyIcon className="h-3 w-3" /></Toggle></EditorGenericTrigger>
						</div>
					</EditorInlineToolbar>

					<EditorBlock name="quote" label="Quote">
						<EditorBlockContent />
					</EditorBlock>

					<EditorBlock name="image" label="Image">
						<ImageField baseField="image" urlField="url" />
					</EditorBlock>
				</BlockEditorField>
			</div>
			<EditorJson />
		</EntitySubTree>
	</Binding>
)

const EditorJson = () => {
	const data = useField('data')

	return (
		<pre className="bg-gray-800 text-white p-4 mt-16">
			{JSON.stringify(data.value, null, 2)}
		</pre>
	)
}

const ConfirmReferenceButton = () => {
	const reference = useEntity()

	return (
		<PopoverClose asChild>
			<EditorWrapNodeTrigger
				elementType="link"
				suchThat={{ referenceId: reference.id }}
			>
				<Button>Insert</Button>
			</EditorWrapNodeTrigger>
		</PopoverClose>
	)
}


const LinkElement = (props: EditorRenderElementProps) => {
	const editor = useSlateStatic()

	return (
		<span {...props.attributes}>
			<span className="bg-gray-50 border-b border-b-blue-300">
				{props.children}
			</span>
			<span contentEditable={false}>
				<Popover
				>
					<PopoverTrigger asChild>
						<button className="hover:bg-gray-200 p-1.5 border border-gray-200 rounded"><LinkIcon className="w-2 h-2" /></button>
					</PopoverTrigger>
					<PopoverContent>
						<div className="flex gap-2 items-center">
							<LinkField field="link" />

							<Button variant="destructive" size="sm" onClick={() => EditorTransforms.unwrapNodes(editor, { at: [], match: node => node === props.element })}>
								<TrashIcon className="w-3 h-3"/>
							</Button>
						</div>
					</PopoverContent>
				</Popover>
			</span>
		</span>
	)
}


export const LinkField = Component<{ field: string }>(({ field }) => (
	<HasOne field={field}>
		<InputField field="url" />
	</HasOne>
))
