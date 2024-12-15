import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import Box from '@mui/material/Box';
import { Button, Modal } from 'react-bootstrap';
import { ReactNode, useState } from 'react';
import { ProcessModal, ViewDataModal } from './FileModals';


export const DataFilesBox: React.FC = () => {
    const [showData, setShowData] = useState(false);
    const [showProcess, setShowProcess] = useState(false);

    const columns: GridColDef<(typeof rows)[number]>[] = [
        { field: 'id', headerName: 'ID', width: 50 },
        { field: 'name', headerName: 'Name', width: 270 },
        { field: 'size', headerName: 'File Size', width: 100 },
        { field: 'isotopes', headerName: 'Isotope number', width: 120 },
        { field: 'rows', headerName: 'Row count', width: 100 },
        { field: 'fileType', headerName: 'Data Source', width: 120 },
        { field: 'status', headerName: 'Status', width: 100 },
        { field: 'results', headerName: 'Results', width: 80 },
        {
            field: 'actions',
            sortable: false,
            filterable: false,
            headerName: 'Actions',
            width: 350,
            renderCell: (params: GridRenderCellParams<any, boolean>): ReactNode => {
                return <>
                   <Button size='sm' onClick={() => setShowData(true)}>View</Button>&nbsp;
                   {params.row.status === 'new' ?
                    <Button size='sm' onClick={() => setShowProcess(true)}>Pre-Process</Button> :
                    <>{params.row.status === 'processed' ? <><Button size='sm'>Original</Button>&nbsp;</> : ''}
                      {params.row.results ?
                        <><Button size='sm'>Results</Button>&nbsp;<Button size='sm'>Re-run Recognition</Button></> :
                        <Button size='sm'>Run Recognition</Button>}
                    </>}
                </>;
            }
        },
    ];

    const rows = [
        { id: 1, fileType: 'LA-ICP-MS', name: 'Sample 1', size: '17MB', date: '2024-12-01 14:30', isotopes: 30, rows: 1452, status: 'new', results: false },
        { id: 2, fileType: 'LA-ICP-MS', name: 'Sample 2', size: '21MB', date: '2024-11-28 08:30', isotopes: 28, rows: 1730, status: 'processed', results: false },
        { id: 3, fileType: 'External', name: 'External 1', size: '12MB', date: '2024-10-01 11:03', isotopes: 15, rows: 210, status: 'external', results: false },
        { id: 4, fileType: 'External', name: 'Other external', size: '21MB', date: '2024-12-01 14:30', isotopes: 16, rows: 220, status: 'external', results: true },
        { id: 5, fileType: 'LA-ICP-MS', name: 'New Sample', size: '21MB', date: '2024-12-15 20:10', isotopes: 28, rows: 1600, status: 'processed', results: true }
    ]
    return <>
        <Modal show={!!showData} fullscreen onHide={() => setShowData(false)}>
            <ViewDataModal {...{ showData, setShowData }} />
        </Modal>
        <Modal show={!!showProcess} onHide={() => setShowProcess(false)}>
            <ProcessModal {...{ showProcess, setShowProcess }} />
        </Modal>
        <Box sx={{ height: 400, width: '100%', marginTop: 2, marginBottom: 2 }}>
            <DataGrid rows={rows} columns={columns} disableRowSelectionOnClick />
        </Box>
    </>
}