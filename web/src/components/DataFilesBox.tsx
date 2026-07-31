import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import { ReactNode, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../AppState';
import { downloadDataset, removeDataset, getDatasets, getPrefix } from '../services';
import "bootstrap-icons/font/bootstrap-icons.css";
import { EditDetailsModal, PreprocessModal, RemoveConfirmModal } from './DataOpsModals';

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
