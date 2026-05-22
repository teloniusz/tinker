import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import { Button, Modal } from 'react-bootstrap';
import { ReactNode, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { downloadDataset, removeDataset, getDatasets, getPrefix } from '../services';
import "bootstrap-icons/font/bootstrap-icons.css";

export const EditDetailsModal: React.FC<{ show: boolean, onHide: () => void, dataset: any }> = ({ show, onHide, dataset }) => {
    return (
        <Modal show={show} onHide={onHide}>
            <Modal.Header closeButton>
                <Modal.Title>Edit/Details Dataset</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {dataset ? (
                    <div>
                        <p><strong>ID:</strong> {dataset.id}</p>
                        <p><strong>Dataset Name:</strong> {dataset.datasetName}</p>
                        <p><strong>Filename:</strong> {dataset.filename}</p>
                        <p><strong>File Count:</strong> {dataset.fileCount}</p>
                    </div>
                ) : <p>No dataset selected.</p>}
            </Modal.Body>
            <Modal.Footer>
                <Button variant='secondary' onClick={onHide}>Close</Button>
            </Modal.Footer>
        </Modal>
    );
};

export const PreprocessModal: React.FC<{ show: boolean, onHide: () => void, dataset: any }> = ({ show, onHide, dataset }) => {
    return (
        <Modal show={show} onHide={onHide}>
            <Modal.Header closeButton>
                <Modal.Title>Preprocess Dataset {dataset?.id}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {dataset ? (
                    <div>
                        <p>Preprocess stub modal.</p>
                    </div>
                ) : <p>No dataset selected.</p>}
            </Modal.Body>
            <Modal.Footer>
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

export const DataSetsTable: React.FC = () => {
    const [rows, setRows] = useState<any[]>([]);
    const [showEdit, setShowEdit] = useState(false);
    const [showRemove, setShowRemove] = useState(false);
    const [showPreprocess, setShowPreprocess] = useState(false);
    const [selectedDataset, setSelectedDataset] = useState<any>(null);
    const navigate = useNavigate();

    useEffect(() => {
        getDatasets().then(data => setRows(data));
    }, []);

    const handleDownload = async (id: number) => {
        const blob = await downloadDataset(id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dataset_${id}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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

    const columns: GridColDef[] = [
        { field: 'id', headerName: 'ID', width: 50 },
        { field: 'datasetName', headerName: 'Dataset name', width: 200 },
        { field: 'filename', headerName: 'Filename', width: 200 },
        { field: 'fileCount', headerName: 'File count', width: 100 },
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
                       <i className="bi bi-trash" style={{ cursor: 'pointer', color: '#dc3545' }} title="Remove" onClick={() => { setSelectedDataset(row); setShowRemove(true); }}></i>
                       <i className="bi bi-gear" style={{ cursor: 'pointer', color: '#6c757d' }} title="Preprocess" onClick={() => { setSelectedDataset(row); setShowPreprocess(true); }}></i>
                       <img src={prefix + '/inksnet.svg'} style={{ cursor: 'pointer', width: 24, height: 24 }} title="InksNet prediction" onClick={() => navigate(`/inksnet/${row.id}`)} />
                   </div>
                );
            }
        },
    ];

    return <>
        <EditDetailsModal show={showEdit} onHide={() => setShowEdit(false)} dataset={selectedDataset} />
        <RemoveConfirmModal show={showRemove} onHide={() => setShowRemove(false)} onConfirm={handleRemoveConfirm} dataset={selectedDataset} />
        <PreprocessModal show={showPreprocess} onHide={() => setShowPreprocess(false)} dataset={selectedDataset} />
        <Box sx={{ height: 400, width: '100%', marginTop: 2, marginBottom: 2 }}>
            <DataGrid rows={rows} columns={columns} disableRowSelectionOnClick />
        </Box>
    </>
}
