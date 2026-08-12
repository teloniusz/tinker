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
      <h5>Version: {version.version} ({version.created ? new Date(Date.parse(version.created)).toDateString() : ''})</h5>
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
