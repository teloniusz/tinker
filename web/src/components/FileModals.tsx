import { Button, Form, Modal } from 'react-bootstrap'
import { TTip } from './Tooltip'
import { FormItem } from './FormItem'
import React, { useState } from 'react'
import { FormSelect } from './FormItem'
import { useAppState } from '../AppState'
import { uploadDataset } from '../services'


export const UploadModal: React.FC<{
  setShowUpload: (el: boolean) => void,
  onUploadSuccess?: () => void // <-- add this line
}> = props => {
  const { setShowUpload, onUploadSuccess } = props; // <-- update destructure
  const [file, setFile] = useState<File | null>(null)
  const [label, setLabel] = useState<string>('')
  const [common, setCommon] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string[]> | undefined>(undefined)
  const generalErrors = errors && errors._ ? errors._ : undefined;
  const [ { isAdmin } ] = useAppState();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files && e.target.files[0]
      setFile(f || null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors(undefined)
    if (!file) return
    setSubmitting(true)
    try {
      const res = await uploadDataset(file, label || file.name, common)
      if (res && res.meta && res.meta.code !== 200) {
        // Handle field_errors from backend
        if (res.response && res.response.field_errors) {
          setErrors(res.response.field_errors)
        } else {
          setErrors({ name: ['Upload failed: Unexpected error'] })
        }
      } else if (res && (res as any).dataset_id) {
        setShowUpload(false)
        if (onUploadSuccess) onUploadSuccess(); // <-- call callback
      } else {
        setErrors({ name: ['Upload failed: Unexpected response'] })
      }
    } catch (err: any) {
      if (err && err.code === 413) {
        setErrors({ name: ['File too large. Maximum allowed size is 64MB.'] })
      } else if (err && err.code === 405) {
        setErrors({ name: ['Upload not allowed (405). Please contact support.'] })
      } else {
        setErrors({ name: ['Upload failed: ' + (err?.message || 'Unknown error')] })
      }
    } finally {
      setSubmitting(false)
    }
  }

    return (
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>Upload a file</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <TTip text='Select a file to upload'>
              <>
                <FormItem type='file' name='file' required onChange={handleFileChange} />
              </>
            </TTip>
            {generalErrors && (
              <div style={{ color: 'red', marginBottom: 10 }}>
                {generalErrors.map((msg, i) => <div key={i}>{msg}</div>)}
              </div>
            )}
            <FormItem name='name' label='Dataset label' value={label} onChange={(e: any) => setLabel(e.target.value)} {...(errors ? errors : {})} />
            {isAdmin && (
              <FormSelect name='common' label='Dataset type' value={common ? 'common' : 'private'} onChange={e => setCommon(e.target.value === 'common')}>
                {[
                  <option key='private' value='private'>Private (only you)</option>,
                  <option key='common' value='common'>Common (all users)</option>
                ]}
              </FormSelect>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant='primary' type='submit' disabled={submitting || !file}>
              {submitting ? 'Uploading...' : 'Upload'}
            </Button>
            <Button variant='secondary' onClick={() => setShowUpload(false)}>
              Close
            </Button>
          </Modal.Footer>
        </Form>
    );
}


export const ProcessModal: React.FC<{ showProcess: boolean, setShowProcess: (el: boolean) => void }> = data => {
    return (
        <Form>
          <Modal.Header closeButton>
            <Modal.Title>Process file data</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <FormItem name='name' readOnly label='File name' value='Sample 1'/>
            <FormItem name='description' readOnly rows={4} value={'Data from LA-ICP-MS\n'} />
            <FormItem name='blank_sample' label='Number of rows for blank sample removal' defaultValue='250'/>
            <FormItem name='spike_rm_cnt' label='Number of spike removal rounds' defaultValue='3'/>
            <FormItem name='isotopes' label='Limit the analysis to these isotopes (optional)' placeholder='Enter space-separated isotope names'/>
          </Modal.Body>
          <Modal.Footer>
            <Button variant='primary' type='submit'>
              Process
            </Button>
            <Button variant='secondary' onClick={() => data.setShowProcess(false)}>
              Close
            </Button>
          </Modal.Footer>
        </Form>
    );
}
