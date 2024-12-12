import React, { useEffect } from 'react'
import { VersionResponse } from '../models/version'

interface VersionBoxProps {
  version: VersionResponse
  fetchVersion: () => void
}

export const VersionBox: React.FC<VersionBoxProps> = ({ version, fetchVersion }) => {
  useEffect(() => {
    fetchVersion()
  }, [fetchVersion])
  const showVer = version.version ? (
    <>
      <h5>Version: {version.version}</h5>
      <h5>Last modified: {version.modified?.toString()}</h5>
    </>
  ) : (
    <div></div>
  )
  return (
    <div className='version' style={{ marginTop: '10px' }}>
      {showVer}
    </div>
  )
}
