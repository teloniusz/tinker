import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import { Button, Modal } from 'react-bootstrap';
import { ReactNode, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../AppState';
import { downloadDataset, removeDataset, getDatasets, getPrefix, preprocessDataset, downloadProcessedData, updateDataset } from '../services';
import "bootstrap-icons/font/bootstrap-icons.css";

export const EditDetailsModal: React.FC<{
    show: boolean;
    onHide: () => void;
    dataset: any;
    onRefresh?: (id: number) => Promise<void>;
}> = ({ show, onHide, dataset, onRefresh }) => {
    const [editedLabels, setEditedLabels] = useState<Record<number, string>>({});
    const [editingFileId, setEditingFileId] = useState<number | null>(null);
    const [editedDatasetLabel, setEditedDatasetLabel] = useState<string | null>(null);
    const [editingDatasetLabel, setEditingDatasetLabel] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (show && dataset) {
            setEditedLabels({});
            setEditingFileId(null);
            setEditedDatasetLabel(null);
            setEditingDatasetLabel(false);
            setErrorMsg('');
        }
    }, [show, dataset]);

    const formatSize = (bytes: number) => {
        if (bytes === undefined || bytes === null) return '-';
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleString();
        } catch {
            return dateStr;
        }
    };

    const isModified = (dataset?.files?.some((file: any) => {
        const current = editedLabels[file.id];
        return current !== undefined && current !== file.label;
    })) || (editedDatasetLabel !== null && editedDatasetLabel !== dataset.label);

    const handleSave = async () => {
        if (!dataset) return;
        setIsSaving(true);
        setErrorMsg('');
        try {
            const datafileLabels: Record<number, string> = {};
            dataset.files.forEach((file: any) => {
                if (editedLabels[file.id] !== undefined) {
                    datafileLabels[file.id] = editedLabels[file.id];
                }
            });
            await updateDataset(dataset.id, editedDatasetLabel, datafileLabels);
            if (onRefresh) {
                await onRefresh(dataset.id);
            }
            setEditedLabels({});
            setEditedDatasetLabel(null);
        } catch (err: any) {
            setErrorMsg(err.message || 'Failed to save dataset labels');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal show={show} onHide={onHide} size="lg">
            <Modal.Header closeButton>
                <Modal.Title>Edit/Details Dataset</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {dataset ? (
                    <div>
                        <p><strong>ID:</strong> {dataset.id}</p>
                        <p>
                            <strong>Dataset Name:</strong>{' '}
                            {editingDatasetLabel ? (
                                <input
                                    type="text"
                                    className="form-control form-control-sm d-inline-block"
                                    style={{ width: 'auto', minWidth: '250px' }}
                                    value={editedDatasetLabel !== null ? editedDatasetLabel : (dataset.label || '')}
                                    onChange={(e) => setEditedDatasetLabel(e.target.value)}
                                    onBlur={() => setEditingDatasetLabel(false)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            setEditingDatasetLabel(false);
                                        }
                                    }}
                                    autoFocus
                                />
                            ) : (
                                <span
                                    style={{
                                        cursor: 'pointer',
                                        borderBottom: '1px dashed #0d6efd',
                                        paddingBottom: '2px',
                                        color: '#0d6efd',
                                        fontWeight: 500
                                    }}
                                    onClick={() => {
                                        setEditingDatasetLabel(true);
                                        if (editedDatasetLabel === null) {
                                            setEditedDatasetLabel(dataset.label || '');
                                        }
                                    }}
                                    title="Click to edit dataset name"
                                >
                                    {editedDatasetLabel !== null ? editedDatasetLabel : (dataset.label || <span className="text-muted"><em>Set label</em></span>)}
                                    <i className="bi bi-pencil ms-2" style={{ fontSize: '0.85rem' }}></i>
                                </span>
                            )}
                        </p>
                        <p><strong>Filename:</strong> {dataset.filename}</p>
                        <p><strong>Files:</strong></p>
                        {errorMsg && <div className="alert alert-danger">{errorMsg}</div>}
                        {!dataset.files || dataset.files.length === 0 ? (
                            <p className="text-muted">No files in this dataset.</p>
                        ) : (
                            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                <table className="table table-bordered table-striped" style={{ marginTop: '10px' }}>
                                    <thead>
                                        <tr>
                                            <th>Filename</th>
                                            <th>Label</th>
                                            <th>Size</th>
                                            <th>Created Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dataset.files.map((file: any) => {
                                            const isEditing = editingFileId === file.id;
                                            const currentLabel = editedLabels[file.id] !== undefined ? editedLabels[file.id] : (file.label || '');
                                            return (
                                                <tr key={file.id}>
                                                    <td>{file.filename}</td>
                                                    <td>
                                                        {isEditing ? (
                                                            <input
                                                                type="text"
                                                                className="form-control form-control-sm"
                                                                value={currentLabel}
                                                                onChange={(e) => setEditedLabels(prev => ({ ...prev, [file.id]: e.target.value }))}
                                                                onBlur={() => setEditingFileId(null)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        setEditingFileId(null);
                                                                    }
                                                                }}
                                                                autoFocus
                                                            />
                                                        ) : (
                                                            <span
                                                                style={{
                                                                    cursor: 'pointer',
                                                                    display: 'inline-block',
                                                                    borderBottom: '1px dashed #0d6efd',
                                                                    paddingBottom: '2px',
                                                                    color: '#0d6efd',
                                                                    minWidth: '100px'
                                                                }}
                                                                onClick={() => {
                                                                    setEditingFileId(file.id);
                                                                    if (editedLabels[file.id] === undefined) {
                                                                        setEditedLabels(prev => ({ ...prev, [file.id]: file.label || '' }));
                                                                    }
                                                                }}
                                                                title="Click to edit label"
                                                            >
                                                                {currentLabel || <span className="text-muted"><em>Set label</em></span>}
                                                                <i className="bi bi-pencil ms-2" style={{ fontSize: '0.8rem' }}></i>
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>{formatSize(file.size)}</td>
                                                    <td>{formatDate(file.created_date)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ) : <p>No dataset selected.</p>}
            </Modal.Body>
            <Modal.Footer>
                {isModified && (
                    <Button variant='primary' disabled={isSaving} onClick={handleSave}>
                        {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                )}
                <Button variant='secondary' onClick={onHide}>Close</Button>
            </Modal.Footer>
        </Modal>
    );
};

export const PreprocessModal: React.FC<{ show: boolean, onHide: () => void, dataset: any, onRefresh?: (id: number) => Promise<void> }> = ({ show, onHide, dataset, onRefresh }) => {
    const [busy, setBusy] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    useEffect(() => {
        if (!dataset) {
            setStatusMessage('');
            return;
        }
        setStatusMessage(dataset.processed ? 'Processed' : 'Not processed');
    }, [dataset]);

    const handleRunPreprocess = async () => {
        if (!dataset) return;
        setBusy(true);
        setStatusMessage('Requesting preprocess...');
        try {
            await preprocessDataset(dataset.id);
            if (onRefresh) {
                await onRefresh(dataset.id);
            }
            setStatusMessage('Preprocess succeeded. Reloaded status.');
        } catch (err: any) {
            setStatusMessage(`Preprocess failed: ${err?.message || err}`);
        } finally {
            setBusy(false);
        }
    };

    const handleDownloadProcessed = async () => {
        if (!dataset) return;
        setBusy(true);
        try {
            const { blob, filename } = await downloadProcessedData(dataset.id);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err: any) {
            setStatusMessage(`Download failed: ${err?.message || err}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal show={show} onHide={onHide}>
            <Modal.Header closeButton>
                <Modal.Title>Preprocess Dataset {dataset?.id}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {dataset ? (
                    <div>
                        <p><strong>Dataset:</strong> {dataset.label || dataset.filename}</p>
                        <p><strong>Status:</strong> {dataset.processed ? 'Processed' : 'Not processed'}</p>
                        {statusMessage && <p><strong>Info:</strong> {statusMessage}</p>}
                    </div>
                ) : <p>No dataset selected.</p>}
            </Modal.Body>
            <Modal.Footer>
                {dataset && !dataset.processed && (
                    <Button variant='primary' disabled={busy} onClick={handleRunPreprocess}>
                        {busy ? 'Running pre-process...' : 'Run pre-process'}
                    </Button>
                )}
                {dataset && dataset.processed && (
                    <Button variant='primary' disabled={busy} onClick={handleDownloadProcessed}>
                        {busy ? 'Downloading...' : 'Download processed data'}
                    </Button>

                )}
                <Button variant='secondary' onClick={onHide}>Close</Button>
            </Modal.Footer>
        </Modal>
    );
};

export const RemoveConfirmModal: React.FC<{ show: boolean, onHide: () => void, onConfirm: () => void, dataset: any }> = ({ show, onHide, onConfirm, dataset }) => {
    return (
        <Modal show={show} onHide={onHide}>
            <Modal.Header closeButton>
                <Modal.Title>Confirm Removal</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p>Are you sure you want to remove {dataset?.datasetName}?</p>
            </Modal.Body>
            <Modal.Footer>
                <Button variant='danger' onClick={onConfirm}>Remove</Button>
                <Button variant='secondary' onClick={onHide}>Cancel</Button>
            </Modal.Footer>
        </Modal>
    );
};

export const DataSetsTable: React.FC<{ reloadKey?: number }> = ({ reloadKey }) => {
    const [rows, setRows] = useState<any[]>([]);
    const [showEdit, setShowEdit] = useState(false);
    const [showRemove, setShowRemove] = useState(false);
    const [showPreprocess, setShowPreprocess] = useState(false);
    const [selectedDataset, setSelectedDataset] = useState<any>(null);
    const [ { isAdmin } ] = useAppState();
    const navigate = useNavigate();

    useEffect(() => {
        getDatasets().then(data => setRows(data));
    }, [reloadKey]); // depend on reloadKey

    const handleDownload = async (id: number) => {
        const { blob, filename } = await downloadDataset(id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `dataset-${id}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const refreshDataset = async (id?: number) => {
        const data = await getDatasets();
        setRows(data);
        if (id != null) {
            const updated = data.find(r => r.id === id);
            if (updated) {
                setSelectedDataset(updated);
            }
        }
    };

    const handleRemoveConfirm = async () => {
        if (selectedDataset) {
            await removeDataset(selectedDataset.id);
            setRows(rows.filter(r => r.id !== selectedDataset.id));
        }
        setShowRemove(false);
        setSelectedDataset(null);
    };

    const prefix = getPrefix();

    const visibilityColumn: GridColDef = {
        field: 'visibility',
        headerName: 'Visibility',
        width: 120,
        sortable: false,
        filterable: false,
        renderCell: (params: GridRenderCellParams<any, boolean>): ReactNode => {
            const row = params.row;
            const isPublic = row.user_id === 0 || row.user_id === null;
            return (
                <span title={isPublic ? 'Public dataset' : 'Private dataset'}>
                    <i
                        className={`bi ${isPublic ? 'bi-globe' : 'bi-lock-fill'}`}
                        style={{ color: isPublic ? '#0d6efd' : '#6c757d', fontSize: '1.2rem' }}
                    />
                </span>
            );
        }
    };

    const columns: GridColDef[] = [
        { field: 'id', headerName: 'ID', width: 50 },
        { field: 'label', headerName: 'Dataset name', width: 200 },
        { field: 'filename', headerName: 'Filename', width: 200 },
        { field: 'fileCount', headerName: 'File count', valueGetter: (_, row) => row.files.length, width: 100 },
        ...(isAdmin ? [visibilityColumn] : []),
        {
            field: 'actions',
            sortable: false,
            filterable: false,
            headerName: 'Operations',
            width: 250,
            renderCell: (params: GridRenderCellParams<any, boolean>): ReactNode => {
                const row = params.row;
                return (
                   <div style={{ display: 'flex', gap: '15px', alignItems: 'center', height: '100%', fontSize: '1.2rem' }}>
                       <i className="bi bi-pencil-square" style={{ cursor: 'pointer', color: '#0d6efd' }} title="Edit/Details" onClick={() => { setSelectedDataset(row); setShowEdit(true); }}></i>
                       <i className="bi bi-download" style={{ cursor: 'pointer', color: '#198754' }} title="Download" onClick={() => handleDownload(row.id)}></i>
                       {!((row.user_id === 0 || row.user_id === null) && !isAdmin) && (
                           <i className="bi bi-trash" style={{ cursor: 'pointer', color: '#dc3545' }} title="Remove" onClick={() => { setSelectedDataset(row); setShowRemove(true); }}></i>
                       )}
                       <i className="bi bi-gear" style={{ cursor: 'pointer', color: '#6c757d' }} title="Preprocess" onClick={() => { setSelectedDataset(row); setShowPreprocess(true); }}></i>
                       {row.processed && (
                           <img alt="InksNet logo" src={prefix + '/inksnet.svg'} style={{ cursor: 'pointer', width: 24, height: 24 }} title="InksNet prediction" onClick={() => navigate(`/inksnet/${row.id}`)} />
                       )}
                   </div>
                );
            }
        },
    ];

    return <>
        <EditDetailsModal show={showEdit} onHide={() => setShowEdit(false)} dataset={selectedDataset} onRefresh={refreshDataset} />
        <RemoveConfirmModal show={showRemove} onHide={() => setShowRemove(false)} onConfirm={handleRemoveConfirm} dataset={selectedDataset} />
        <PreprocessModal show={showPreprocess} onHide={() => setShowPreprocess(false)} dataset={selectedDataset} onRefresh={refreshDataset} />
        <Box sx={{ height: 400, width: '100%', marginTop: 2, marginBottom: 2 }}>
            <DataGrid rows={rows} columns={columns} disableRowSelectionOnClick />
        </Box>
    </>
}
