'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphData, GraphNode, GraphLink } from '@/app/types/spotify';

interface ForceGraphProps {
  data: GraphData;
  width?: number;
  height?: number;
  viewMode?: 'network' | 'hierarchical';
}

const ForceGraph: React.FC<ForceGraphProps> = ({ data, width = 1200, height = 800, viewMode = 'network' }) => {
  const svgRef = useRef<SVGSVGElement>(null);
    const [dynamicMode, setDynamicMode] = useState<boolean>(false);
  const [trackClustering, setTrackClustering] = useState<boolean>(true);
  const [artistClustering, setArtistClustering] = useState<boolean>(true);
  const [albumClustering, setAlbumClustering] = useState<boolean>(true);
  
  // Layer visibility toggles
  const [showGenres, setShowGenres] = useState<boolean>(true);
  const [showArtists, setShowArtists] = useState<boolean>(true);
  const [showAlbums, setShowAlbums] = useState<boolean>(true);
  const [showTracks, setShowTracks] = useState<boolean>(true);
  
  const [linkOpacities, setLinkOpacities] = useState({
    'genre-artist': 0.6,
    'artist-album': 0.7,
    'album-track': 0.8,
    'artist-track': 0.8,
    'cluster-artist': 0.4,
    'cluster-album': 0.4,
    'cluster-track': 0.3,
    'genre-cluster': 0.5,
  });

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Color scales for different node types
    const colorScale = {
      genre: '#FF10F0', // neon-pink
      artist: '#A855F7', // dark neon purple
      album: '#10FF80', // neon green for albums
      track: '#0080FF', // vibrant electric blue
      cluster: '#FFFFFF', // invisible artist clustering nodes
      'genre-cluster': '#FFFFFF', // invisible genre clustering nodes
      'album-cluster': '#FFFFFF', // invisible album clustering nodes
    };

    // Create container for zoom
    const container = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Dynamic parameters based on node count
    const nodeCount = data.nodes.length;
    const isSmall = nodeCount <= 400;
    const isMedium = nodeCount <= 800;
    const isLarge = nodeCount <= 1200;
    
    // Adjust parameters based on size
    const linkDistance = isSmall ? 120 : isMedium ? 100 : isLarge ? 80 : 60;
    const genreLinkDistance = isSmall ? 150 : isMedium ? 130 : isLarge ? 100 : 80;
    const chargeStrength = isSmall ? -600 : isMedium ? -400 : isLarge ? -250 : -150;
    const genreChargeStrength = isSmall ? -800 : isMedium ? -600 : isLarge ? -400 : -250;
    const distanceMax = isSmall ? 500 : isMedium ? 400 : isLarge ? 300 : 200;
    const collisionPadding = isSmall ? 10 : isMedium ? 8 : isLarge ? 6 : 4;
    const alphaDecay = isSmall ? 0.02 : isMedium ? 0.03 : isLarge ? 0.04 : 0.05;
    const velocityDecay = isSmall ? 0.3 : isMedium ? 0.35 : isLarge ? 0.4 : 0.5;
    const linkOpacity = isSmall ? 0.2 : isMedium ? 0.15 : isLarge ? 0.1 : 0.05;
    const tickFrequency = isSmall ? 1 : isMedium ? 2 : isLarge ? 2 : 3;
    const minLabelRadius = isSmall ? 10 : isMedium ? 12 : isLarge ? 15 : 18;

    // Hierarchical positioning for y-axis
    const isHierarchical = viewMode === 'hierarchical';

    // Create force simulation with dynamic parameters
    const simulation = d3.forceSimulation<GraphNode>()
      .force('link', d3.forceLink<GraphNode, GraphLink>()
        .id((d) => d.id)
        .distance((d) => {
          const source = filteredNodes.find(n => n.id === (d.source as any).id || n.id === d.source);
          const target = filteredNodes.find(n => n.id === (d.target as any).id || n.id === d.target);
          
          if (isHierarchical) {
            // Radial distances for circular clustering
            if ((source?.group === 'genre' && target?.group === 'artist') ||
                (source?.group === 'artist' && target?.group === 'genre')) {
              return 160; // Increased from 120 for larger genre nodes
            }
            if ((source?.group === 'artist' && target?.group === 'track') ||
                (source?.group === 'track' && target?.group === 'artist')) {
              return 80; // Reduced from 100 for tighter track clustering
            }
            // Much longer distances for non-hierarchical connections
            return 300;
          }
          
          if (source?.group === 'genre' || target?.group === 'genre') {
            return genreLinkDistance / d.strength;
          }
          return linkDistance / d.strength;
        })
        .strength((d) => {
          if (isHierarchical) {
            const source = filteredNodes.find(n => n.id === (d.source as any).id || n.id === d.source);
            const target = filteredNodes.find(n => n.id === (d.target as any).id || n.id === d.target);
            
            // Strong attraction for parent-child relationships
            if ((source?.group === 'genre' && target?.group === 'artist') ||
                (source?.group === 'artist' && target?.group === 'genre')) {
              return 0.8;
            }
            if ((source?.group === 'artist' && target?.group === 'track') ||
                (source?.group === 'track' && target?.group === 'artist')) {
              return 0.6;
            }
            // Very weak for other connections
            return 0.05;
          }
          return d.strength * (isSmall ? 0.8 : isMedium ? 0.7 : 0.5);
        }))
      .force('charge', d3.forceManyBody<GraphNode>()
        .strength((d) => {
          // Clustering nodes have minimal charge to avoid interference
          if (d.group === 'cluster' || d.group === 'genre-cluster' || d.group === 'album-cluster') {
            return -10; // Very weak repulsion
          }
          
          if (isHierarchical) {
            // Different charge based on node type and size for circular layout
            if (d.group === 'genre') {
              const radius = 30 + (d.radius || 20) * 0.5;
              return -1200 - radius * 10; // Stronger repulsion for larger genre nodes
            }
            if (d.group === 'artist') {
              const radius = Math.max(15, Math.min(30, (d.popularity || 50) / 3.3));
              return -400 - radius * 5; // Medium repulsion
            }
            if (d.group === 'album') {
              const radius = Math.max(12, Math.min(25, (d.popularity || 50) / 4));
              return -250 - radius * 4; // Medium-light repulsion for albums
            }
            const radius = Math.max(8, Math.min(15, (d.popularity || 50) / 6.7));
            return -150 - radius * 3; // Light repulsion for small track nodes
          }
          
          if (d.group === 'genre') {
            return genreChargeStrength - (d.radius || 10) * 5;
          }
          if (d.group === 'album') {
            return chargeStrength * 0.7 - (d.radius || 10) * 2;
          }
          return chargeStrength - (d.radius || 10) * 2;
        })
        .distanceMax(isHierarchical ? 600 : distanceMax))
      .force('collision', d3.forceCollide<GraphNode>()
        .radius((d) => {
          // Clustering nodes have minimal collision radius
          if (d.group === 'cluster' || d.group === 'genre-cluster' || d.group === 'album-cluster') {
            return 1; // Very small collision radius
          }
          
          let radius;
          if (isHierarchical) {
            // Use the same radius calculation as the visual nodes
            if (d.group === 'genre') {
              radius = 30 + (d.radius || 20) * 0.5;
            } else if (d.group === 'artist') {
              radius = Math.max(15, Math.min(30, (d.popularity || 50) / 3.3));
            } else if (d.group === 'album') {
              radius = Math.max(12, Math.min(25, (d.popularity || 50) / 4));
            } else {
              radius = Math.max(8, Math.min(15, (d.popularity || 50) / 6.7));
            }
          } else {
            radius = d.radius || 10;
          }
          return radius + (isHierarchical ? collisionPadding * 0.7 : collisionPadding);
        })
        .strength(0.7)
        .iterations(isSmall ? 2 : 1))
      .alphaDecay(alphaDecay)
      .velocityDecay(velocityDecay);

    // Filter nodes based on visibility settings
    const visibleNodeIds = new Set<string>();
    data.nodes.forEach(node => {
      if (node.invisible) {
        visibleNodeIds.add(node.id); // Always include invisible nodes for physics
      } else if (node.group === 'genre' && showGenres) {
        visibleNodeIds.add(node.id);
      } else if (node.group === 'artist' && showArtists) {
        visibleNodeIds.add(node.id);
      } else if (node.group === 'album' && showAlbums) {
        visibleNodeIds.add(node.id);
      } else if (node.group === 'track' && showTracks) {
        visibleNodeIds.add(node.id);
      }
    });

    // Filter nodes based on visibility
    let filteredNodes = data.nodes.filter(node => visibleNodeIds.has(node.id));
    
    // Identify albums that only have one connected track and should be bypassed
    const singleTrackAlbums = new Set<string>();
    const albumTrackCount = new Map<string, number>();
    
    // Count tracks per album in filtered nodes
    filteredNodes.filter(n => n.group === 'track').forEach(track => {
      // Find which album this track belongs to
      const albumLink = data.links.find(l => 
        l.type === 'album-track' && 
        ((l.source === track.id && filteredNodes.find(n => n.id === l.target)?.group === 'album') ||
         (l.target === track.id && filteredNodes.find(n => n.id === l.source)?.group === 'album'))
      );
      
      if (albumLink) {
        const albumId = albumLink.source === track.id ? albumLink.target : albumLink.source;
        if (typeof albumId === 'string') {
          albumTrackCount.set(albumId, (albumTrackCount.get(albumId) || 0) + 1);
        }
      }
    });
    
    // Mark albums with only one track for removal
    albumTrackCount.forEach((count, albumId) => {
      if (count === 1) {
        singleTrackAlbums.add(albumId);
      }
    });
    
    // Remove single-track albums from filtered nodes
    filteredNodes = filteredNodes.filter(node => 
      !(node.group === 'album' && singleTrackAlbums.has(node.id))
    );

    // Add center force for non-hierarchical view
    if (!isHierarchical) {
      simulation.force('center', d3.forceCenter(width / 2, height / 2));
    } else {
      // For hierarchical view, use radial positioning
      
      // First, find primary connections for clustering
      const nodeParents = new Map<string, string>();
      
      // Map artists to their primary genre (first genre)
      filteredNodes.filter(n => n.group === 'artist').forEach(artist => {
        const genreLink = data.links.find(l => 
          (l.source === artist.id && filteredNodes.find(n => n.id === l.target)?.group === 'genre') ||
          (l.target === artist.id && filteredNodes.find(n => n.id === l.source)?.group === 'genre')
        );
        if (genreLink) {
          const genreId = genreLink.source === artist.id ? genreLink.target : genreLink.source;
          nodeParents.set(artist.id, genreId as string);
        }
      });
      
      // Map albums to their primary parent (artist or genre) based on visibility
      filteredNodes.filter(n => n.group === 'album').forEach(album => {
        // First try to find artist link (if artists are visible)
        if (showArtists) {
          const artistLink = data.links.find(l => 
            (l.source === album.id && filteredNodes.find(n => n.id === l.target)?.group === 'artist') ||
            (l.target === album.id && filteredNodes.find(n => n.id === l.source)?.group === 'artist')
          );
          if (artistLink) {
            const artistId = artistLink.source === album.id ? artistLink.target : artistLink.source;
            nodeParents.set(album.id, artistId as string);
            return;
          }
        }
        
        // Fallback to genre link (if genres are visible and artists are hidden)
        if (showGenres) {
          const genreLink = data.links.find(l => 
            (l.source === album.id && filteredNodes.find(n => n.id === l.target)?.group === 'genre') ||
            (l.target === album.id && filteredNodes.find(n => n.id === l.source)?.group === 'genre')
          );
          if (genreLink) {
            const genreId = genreLink.source === album.id ? genreLink.target : genreLink.source;
            nodeParents.set(album.id, genreId as string);
          }
        }
      });
      
      // Map tracks to their primary parent (album, artist, or genre) based on visibility
      filteredNodes.filter(n => n.group === 'track').forEach(track => {
        // First try to find album link (if albums are visible and not bypassed)
        if (showAlbums) {
          const albumLink = data.links.find(l => 
            (l.source === track.id && filteredNodes.find(n => n.id === l.target)?.group === 'album') ||
            (l.target === track.id && filteredNodes.find(n => n.id === l.source)?.group === 'album')
          );
          if (albumLink) {
            const albumId = albumLink.source === track.id ? albumLink.target : albumLink.source;
            // Skip if album was bypassed due to single-track rule
            if (!singleTrackAlbums.has(albumId as string)) {
              nodeParents.set(track.id, albumId as string);
              return;
            }
          }
        }
        
        // Fallback to artist link (if artists are visible)
        if (showArtists) {
          const artistLink = data.links.find(l => 
            (l.source === track.id && filteredNodes.find(n => n.id === l.target)?.group === 'artist') ||
            (l.target === track.id && filteredNodes.find(n => n.id === l.source)?.group === 'artist')
          );
          if (artistLink) {
            const artistId = artistLink.source === track.id ? artistLink.target : artistLink.source;
            nodeParents.set(track.id, artistId as string);
            return;
          }
        }
        
        // Final fallback to genre link (if genres are visible)
        if (showGenres) {
          const genreLink = data.links.find(l => 
            (l.source === track.id && filteredNodes.find(n => n.id === l.target)?.group === 'genre') ||
            (l.target === track.id && filteredNodes.find(n => n.id === l.source)?.group === 'genre')
          );
          if (genreLink) {
            const genreId = genreLink.source === track.id ? genreLink.target : genreLink.source;
            nodeParents.set(track.id, genreId as string);
          }
        }
      });
      
      // Position genres in a circle
      const genres = data.nodes.filter(n => n.group === 'genre');
      const genreCount = genres.length;
      const genreRadius = Math.min(width, height) * 0.3; // Increased from 0.25 to accommodate larger nodes
      
      // Custom positioning force
      const positionForce = (alpha: number) => {
        filteredNodes.forEach((d: GraphNode) => {
          if (d.group === 'genre') {
            // Position genres in a circle
            const index = genres.findIndex(g => g.id === d.id);
            const angle = (index / genreCount) * 2 * Math.PI;
            const targetX = width / 2 + genreRadius * Math.cos(angle);
            const targetY = height / 2 + genreRadius * Math.sin(angle);
            
            d.vx = (d.vx || 0) + (targetX - (d.x || 0)) * alpha * 0.5;
            d.vy = (d.vy || 0) + (targetY - (d.y || 0)) * alpha * 0.5;
          } else if (d.group === 'artist') {
            // Position artists around their genre
            const parentId = nodeParents.get(d.id);
            if (parentId) {
              const parent = filteredNodes.find(n => n.id === parentId);
              if (parent && parent.x !== undefined && parent.y !== undefined) {
                const dx = (d.x || 0) - parent.x;
                const dy = (d.y || 0) - parent.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                // Increased distance to account for larger genre nodes
                const targetDistance = 140;
                
                if (distance > 0) {
                  const factor = (targetDistance - distance) / distance * alpha * 0.3;
                  d.vx = (d.vx || 0) + dx * factor;
                  d.vy = (d.vy || 0) + dy * factor;
                }
              }
            }
          } else if (d.group === 'album') {
            // Position albums around their parent (artist or genre)
            const parentId = nodeParents.get(d.id);
            if (parentId) {
              const parent = filteredNodes.find(n => n.id === parentId);
              if (parent && parent.x !== undefined && parent.y !== undefined) {
                const dx = (d.x || 0) - parent.x;
                const dy = (d.y || 0) - parent.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                // Adjusted distance based on parent type
                const targetDistance = parent.group === 'artist' ? 100 : 150; // Further out for genre connections
                
                if (distance > 0) {
                  const factor = (targetDistance - distance) / distance * alpha * 0.3;
                  d.vx = (d.vx || 0) + dx * factor;
                  d.vy = (d.vy || 0) + dy * factor;
                }
              }
            }
          } else if (d.group === 'track') {
            // Position tracks around their parent (album, artist, or genre)
            const parentId = nodeParents.get(d.id);
            if (parentId) {
              const parent = filteredNodes.find(n => n.id === parentId);
              if (parent && parent.x !== undefined && parent.y !== undefined) {
                const dx = (d.x || 0) - parent.x;
                const dy = (d.y || 0) - parent.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                // Adjusted distance based on parent type
                let targetDistance = 50; // Default for album
                if (parent.group === 'artist') targetDistance = 70;
                else if (parent.group === 'genre') targetDistance = 120; // Further out for genre connections
                
                if (distance > 0) {
                  const factor = (targetDistance - distance) / distance * alpha * 0.3;
                  d.vx = (d.vx || 0) + dx * factor;
                  d.vy = (d.vy || 0) + dy * factor;
                }
              }
            }
          }
        });
      };
      
      simulation.force('position', positionForce as any);
      
      // Add a gentle centering force
      simulation.force('center', d3.forceCenter(width / 2, height / 2).strength(0.02));
    }

    // Create dynamic links based on visibility settings
    const createDynamicLinks = () => {
      const dynamicLinks: GraphLink[] = [];
      
      // Start with original links
      data.links.forEach(link => {
        const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
        const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
        
        // Both nodes must be visible
        if (visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId)) {
          // Check clustering settings
          if (trackClustering || link.type !== 'cluster-track') {
            if (artistClustering || link.type !== 'cluster-artist') {
              if (albumClustering || link.type !== 'cluster-album') {
                dynamicLinks.push(link);
              }
            }
          }
        }
      });
      
      // Add dynamic reconnection links for orphaned nodes
      filteredNodes.forEach(node => {
        if (node.group === 'track') {
          // Check if track's album was bypassed due to single-track rule
          const originalAlbumLink = data.links.find(l => 
            l.type === 'album-track' && 
            ((l.source === node.id) || (l.target === node.id))
          );
          
          let trackNeedsArtistConnection = false;
          
          if (originalAlbumLink) {
            const albumId = originalAlbumLink.source === node.id ? originalAlbumLink.target : originalAlbumLink.source;
            // If the album was bypassed due to single-track rule, connect directly to artist
            if (singleTrackAlbums.has(albumId as string)) {
              trackNeedsArtistConnection = true;
            }
          }
          
          // Find if track has album connection (excluding bypassed albums)
          const hasAlbumConnection = dynamicLinks.some(link => {
            const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
            const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
            return (sourceId === node.id || targetId === node.id) && 
                   (link.type === 'album-track') &&
                   !singleTrackAlbums.has(sourceId) && !singleTrackAlbums.has(targetId);
          });
          
          // If no album connection (albums hidden OR bypassed), connect to artists
          if ((!hasAlbumConnection && !showAlbums) || trackNeedsArtistConnection) {
            // Find artist connections in original data
            data.links.forEach(link => {
              const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
              const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
              
              if (link.type === 'artist-track') {
                let artistId: string, trackId: string;
                if (sourceId === node.id) {
                  artistId = targetId;
                  trackId = sourceId;
                } else if (targetId === node.id) {
                  artistId = sourceId;
                  trackId = targetId;
                } else {
                  return;
                }
                
                // Only add if artist is visible
                if (visibleNodeIds.has(artistId)) {
                  const existingLink = dynamicLinks.find(l => {
                    const lSourceId = typeof l.source === 'string' ? l.source : (l.source as any).id;
                    const lTargetId = typeof l.target === 'string' ? l.target : (l.target as any).id;
                    return (lSourceId === artistId && lTargetId === trackId) ||
                           (lSourceId === trackId && lTargetId === artistId);
                  });
                  
                  if (!existingLink) {
                    dynamicLinks.push({
                      source: trackId,
                      target: artistId,
                      strength: 0.8, // Strong connection for direct links
                      type: 'artist-track'
                    });
                  }
                }
              }
            });
          }
          
          // If no artist connection and artists are hidden, connect to genres
          if (!showArtists) {
            const hasArtistConnection = dynamicLinks.some(link => {
              const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
              const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
              return (sourceId === node.id || targetId === node.id) && 
                     (link.type === 'artist-track');
            });
            
            if (!hasArtistConnection) {
              // Find genre connections through artist relationships
              data.links.forEach(artistTrackLink => {
                if (artistTrackLink.type !== 'artist-track') return;
                
                const sourceId = typeof artistTrackLink.source === 'string' ? artistTrackLink.source : (artistTrackLink.source as any).id;
                const targetId = typeof artistTrackLink.target === 'string' ? artistTrackLink.target : (artistTrackLink.target as any).id;
                
                let artistId: string;
                if (sourceId === node.id) {
                  artistId = targetId;
                } else if (targetId === node.id) {
                  artistId = sourceId;
                } else {
                  return;
                }
                
                // Find genre for this artist
                data.links.forEach(genreArtistLink => {
                  if (genreArtistLink.type !== 'genre-artist') return;
                  
                  const gSourceId = typeof genreArtistLink.source === 'string' ? genreArtistLink.source : (genreArtistLink.source as any).id;
                  const gTargetId = typeof genreArtistLink.target === 'string' ? genreArtistLink.target : (genreArtistLink.target as any).id;
                  
                  let genreId: string;
                  if (gSourceId === artistId) {
                    genreId = gTargetId;
                  } else if (gTargetId === artistId) {
                    genreId = gSourceId;
                  } else {
                    return;
                  }
                  
                  // Only add if genre is visible
                  if (visibleNodeIds.has(genreId)) {
                    const existingLink = dynamicLinks.find(l => {
                      const lSourceId = typeof l.source === 'string' ? l.source : (l.source as any).id;
                      const lTargetId = typeof l.target === 'string' ? l.target : (l.target as any).id;
                      return (lSourceId === genreId && lTargetId === node.id) ||
                             (lSourceId === node.id && lTargetId === genreId);
                    });
                    
                    if (!existingLink) {
                      dynamicLinks.push({
                        source: node.id,
                        target: genreId,
                        strength: 0.6, // Medium connection for skip-level links
                        type: 'genre-track' as any
                      });
                    }
                  }
                });
              });
            }
          }
        }
        
        // Handle album reconnections
        if (node.group === 'album') {
          // If artists are hidden, connect albums to genres
          if (!showArtists) {
            const hasArtistConnection = dynamicLinks.some(link => {
              const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
              const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
              return (sourceId === node.id || targetId === node.id) && 
                     (link.type === 'artist-album');
            });
            
            if (!hasArtistConnection) {
              // Find genre connections through artist relationships
              data.links.forEach(artistAlbumLink => {
                if (artistAlbumLink.type !== 'artist-album') return;
                
                const sourceId = typeof artistAlbumLink.source === 'string' ? artistAlbumLink.source : (artistAlbumLink.source as any).id;
                const targetId = typeof artistAlbumLink.target === 'string' ? artistAlbumLink.target : (artistAlbumLink.target as any).id;
                
                let artistId: string;
                if (sourceId === node.id) {
                  artistId = targetId;
                } else if (targetId === node.id) {
                  artistId = sourceId;
                } else {
                  return;
                }
                
                // Find genre for this artist
                data.links.forEach(genreArtistLink => {
                  if (genreArtistLink.type !== 'genre-artist') return;
                  
                  const gSourceId = typeof genreArtistLink.source === 'string' ? genreArtistLink.source : (genreArtistLink.source as any).id;
                  const gTargetId = typeof genreArtistLink.target === 'string' ? genreArtistLink.target : (genreArtistLink.target as any).id;
                  
                  let genreId: string;
                  if (gSourceId === artistId) {
                    genreId = gTargetId;
                  } else if (gTargetId === artistId) {
                    genreId = gSourceId;
                  } else {
                    return;
                  }
                  
                  // Only add if genre is visible
                  if (visibleNodeIds.has(genreId)) {
                    const existingLink = dynamicLinks.find(l => {
                      const lSourceId = typeof l.source === 'string' ? l.source : (l.source as any).id;
                      const lTargetId = typeof l.target === 'string' ? l.target : (l.target as any).id;
                      return (lSourceId === genreId && lTargetId === node.id) ||
                             (lSourceId === node.id && lTargetId === genreId);
                    });
                    
                    if (!existingLink) {
                      dynamicLinks.push({
                        source: node.id,
                        target: genreId,
                        strength: 0.7, // Strong connection for album-genre links
                        type: 'genre-album' as any
                      });
                    }
                  }
                });
              });
            }
          }
        }
      });
      
      return dynamicLinks;
    };
    
    const filteredLinks = createDynamicLinks();
    
    // Final filter to ensure all links reference existing nodes
    const validNodeIds = new Set(filteredNodes.map(n => n.id));
    const validLinks = filteredLinks.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
      return validNodeIds.has(sourceId) && validNodeIds.has(targetId);
    });

    // Create links with dynamic opacity
    const link = container.append('g')
      .selectAll('line')
      .data(validLinks)
      .enter().append('line')
      .attr('stroke', '#ffffff')
      .attr('stroke-opacity', (d) => {
        const baseOpacity = linkOpacities[d.type as keyof typeof linkOpacities] || linkOpacity;
        return baseOpacity;
      })
      .attr('stroke-width', (d) => d.strength * (isSmall ? 1.5 : 1));

    // Create node groups (filter out invisible clustering nodes)
    const visibleNodes = filteredNodes.filter(node => !node.invisible);
    const node = container.append('g')
      .selectAll('g')
      .data(visibleNodes)
      .enter().append('g')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add circles to nodes with standard styling
    node.append('circle')
      .attr('r', (d) => {
        if (isHierarchical) {
          // Hierarchical view: genres largest, artists medium, albums medium-small, tracks smallest
          if (d.group === 'genre') {
            // Genres: 30-50 radius
            return 30 + (d.radius || 20) * 0.5;
          } else if (d.group === 'artist') {
            // Artists: 15-30 radius based on popularity
            return Math.max(15, Math.min(30, (d.popularity || 50) / 3.3));
          } else if (d.group === 'album') {
            // Albums: 12-25 radius based on popularity
            return Math.max(12, Math.min(25, (d.popularity || 50) / 4));
          } else {
            // Tracks: 8-15 radius based on popularity
            return Math.max(8, Math.min(15, (d.popularity || 50) / 6.7));
          }
        }
        return d.radius || 10;
      })
      .attr('fill', (d) => colorScale[d.group])
      .attr('stroke', (d) => colorScale[d.group])
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.8)
      .style('filter', 'url(#glow)');

    // Add labels with dynamic visibility
    node.append('text')
      .text((d) => d.name)
      .attr('x', 0)
      .attr('y', (d) => {
        // Calculate radius based on view mode
        let radius;
        if (isHierarchical) {
          if (d.group === 'genre') {
            radius = 30 + (d.radius || 20) * 0.5;
          } else if (d.group === 'artist') {
            radius = Math.max(15, Math.min(30, (d.popularity || 50) / 3.3));
          } else if (d.group === 'album') {
            radius = Math.max(12, Math.min(25, (d.popularity || 50) / 4));
          } else {
            radius = Math.max(8, Math.min(15, (d.popularity || 50) / 6.7));
          }
        } else {
          radius = d.radius || 10;
        }
        return radius + 15;
      })
      .attr('text-anchor', 'middle')
      .attr('fill', '#ffffff')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .style('text-shadow', '0 0 10px rgba(255, 255, 255, 0.5)')
      .style('display', (d) => {
        // Dynamic label hiding based on node count
        if (d.group === 'track' && (d.radius || 10) < minLabelRadius) {
          return 'none';
        }
        if (d.group === 'artist' && (d.radius || 10) < minLabelRadius + 5) {
          return 'none';
        }
        return 'block';
      });

    // Add glow filter
    const defs = svg.append('defs');
    
    const filter = defs.append('filter')
      .attr('id', 'glow');
    
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'coloredBlur');
    
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode')
      .attr('in', 'coloredBlur');
    feMerge.append('feMergeNode')
      .attr('in', 'SourceGraphic');

    // Add tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('padding', '10px')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('border', '1px solid currentColor')
      .style('border-radius', '5px')
      .style('color', '#ffffff')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 1000);

    // Function to find hierarchical parent and child nodes (vertical relationships only)
    const findVerticalNodes = (nodeId: string): { parents: Set<string>, children: Set<string> } => {
      const parents = new Set<string>();
      const children = new Set<string>();
      
      // Only consider hierarchical links (genre-artist, artist-album, album-track, artist-track), not clustering links
      const hierarchicalLinks = data.links.filter(link => 
        link.type === 'genre-artist' || link.type === 'artist-album' || link.type === 'album-track' || link.type === 'artist-track'
      );
      
      hierarchicalLinks.forEach(link => {
        const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
        const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
        
        // If this node is the target, the source is its parent
        if (targetId === nodeId) {
          parents.add(sourceId);
        }
        
        // If this node is the source, the target is its child
        if (sourceId === nodeId) {
          children.add(targetId);
        }
      });
      
      return { parents, children };
    };

    // Function to find hierarchical links for highlighting
    const findVerticalLinks = (nodeId: string, parents: Set<string>, children: Set<string>): Set<string> => {
      const verticalLinks = new Set<string>();
      const allRelevantNodes = new Set([nodeId, ...Array.from(parents), ...Array.from(children)]);
      
      data.links.forEach((link, index) => {
        const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
        const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
        
        // Only include hierarchical links between relevant nodes
        if ((link.type === 'genre-artist' || link.type === 'artist-album' || link.type === 'album-track' || link.type === 'artist-track') &&
            allRelevantNodes.has(sourceId) && allRelevantNodes.has(targetId)) {
          verticalLinks.add(index.toString());
        }
      });
      
      return verticalLinks;
    };

    // Add hover interaction with improved event handling
    let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
    let currentHoveredNode: string | null = null;

    const applyHighlighting = (d: GraphNode) => {
      if (currentHoveredNode === d.id) return; // Already highlighting this node
      currentHoveredNode = d.id;

      // Find vertical relationships (parents and children in hierarchy)
      const { parents, children } = findVerticalNodes(d.id);
      const verticalLinks = findVerticalLinks(d.id, parents, children);
      const allVerticalNodes = new Set([d.id, ...Array.from(parents), ...Array.from(children)]);
      
      // Highlight the hovered node and its vertical relatives
      node.selectAll('circle')
        .attr('r', (nodeData: any) => {
          let baseRadius;
          if (isHierarchical) {
            if (nodeData.group === 'genre') {
              baseRadius = 30 + (nodeData.radius || 20) * 0.5;
            } else if (nodeData.group === 'artist') {
              baseRadius = Math.max(15, Math.min(30, (nodeData.popularity || 50) / 3.3));
            } else if (nodeData.group === 'album') {
              baseRadius = Math.max(12, Math.min(25, (nodeData.popularity || 50) / 4));
            } else {
              baseRadius = Math.max(8, Math.min(15, (nodeData.popularity || 50) / 6.7));
            }
          } else {
            baseRadius = nodeData.radius || 10;
          }
          
          // Apply dynamic scaling if dynamic mode is enabled
          if (dynamicMode && allVerticalNodes.has(nodeData.id)) {
            return baseRadius * 1.2; // Scale up highlighted nodes
          }
          return baseRadius;
        })
        .attr('stroke-width', (nodeData: any) => {
          if (nodeData.id === d.id) return 4; // Hovered node gets thicker border
          if (parents.has(nodeData.id) || children.has(nodeData.id)) return 3; // Vertical relatives get medium border
          return 2; // Others keep normal border
        })
        .attr('stroke-opacity', (nodeData: any) => {
          if (allVerticalNodes.has(nodeData.id)) return 1;
          return 0.3; // Dim non-related nodes
        })
        .attr('fill-opacity', (nodeData: any) => {
          if (allVerticalNodes.has(nodeData.id)) return 1;
          return 0.3; // Dim non-related nodes
        });

      // Highlight vertical links only
      link.attr('stroke-opacity', (linkData: any, i: number) => {
        if (verticalLinks.has(i.toString())) return 0.8; // Highlight vertical links
        return 0.1; // Dim other links
      })
      .attr('stroke-width', (linkData: any, i: number) => {
        if (verticalLinks.has(i.toString())) {
          return (linkData.strength * (isSmall ? 1.5 : 1)) * 1.5; // Thicker vertical links
        }
        return linkData.strength * (isSmall ? 1.5 : 1);
      });

      // Highlight vertical text labels
      node.selectAll('text')
        .attr('opacity', (nodeData: any) => {
          if (allVerticalNodes.has(nodeData.id)) return 1;
          return 0.3; // Dim non-related labels
        })
        .attr('font-weight', (nodeData: any) => {
          if (allVerticalNodes.has(nodeData.id)) return 'bold';
          return 'normal';
        });

      // Show enhanced tooltip with hierarchical path information
      const getHierarchicalPath = (nodeId: string): string => {
        const node = filteredNodes.find(n => n.id === nodeId);
        if (!node) return '';
        
        if (node.group === 'track') {
          // Track: build full hierarchy path
          let path = node.name;
          let currentId = nodeId;
          let currentParents = parents;
          
          // First check for album parent
          const albumParent = Array.from(currentParents).find(id => filteredNodes.find(n => n.id === id)?.group === 'album');
          if (albumParent) {
            const albumNode = filteredNodes.find(n => n.id === albumParent);
            if (albumNode) {
              path = `${albumNode.name} → ${path}`;
              const { parents: albumParents } = findVerticalNodes(albumParent);
              currentParents = albumParents;
            }
          }
          
          // Then check for artist parent
          const artistParent = Array.from(currentParents).find(id => filteredNodes.find(n => n.id === id)?.group === 'artist');
          if (artistParent) {
            const artistNode = filteredNodes.find(n => n.id === artistParent);
            if (artistNode) {
              path = `${artistNode.name} → ${path}`;
              const { parents: artistParents } = findVerticalNodes(artistParent);
              currentParents = artistParents;
            }
          }
          
          // Finally check for genre
          const genreParent = Array.from(currentParents).find(id => filteredNodes.find(n => n.id === id)?.group === 'genre');
          if (genreParent) {
            const genreNode = filteredNodes.find(n => n.id === genreParent);
            if (genreNode) {
              path = `${genreNode.name} → ${path}`;
            }
          }
          
          return path;
        } else if (node.group === 'album') {
          // Album: find artist parent, then genre
          const artistParent = Array.from(parents).find(id => filteredNodes.find(n => n.id === id)?.group === 'artist');
          if (artistParent) {
            const artistNode = filteredNodes.find(n => n.id === artistParent);
            const { parents: artistParents } = findVerticalNodes(artistParent);
            const genreGrandparent = Array.from(artistParents).find(id => filteredNodes.find(n => n.id === id)?.group === 'genre');
            if (genreGrandparent) {
              const genreNode = filteredNodes.find(n => n.id === genreGrandparent);
              return `${genreNode?.name} → ${artistNode?.name} → ${node.name}`;
            }
            return `${artistNode?.name} → ${node.name}`;
          }
        } else if (node.group === 'artist') {
          // Artist: find genre parent
          const genreParent = Array.from(parents).find(id => filteredNodes.find(n => n.id === id)?.group === 'genre');
          if (genreParent) {
            const genreNode = filteredNodes.find(n => n.id === genreParent);
            return `${genreNode?.name} → ${node.name}`;
          }
        }
        
        return node.name;
      };

      tooltip.transition()
        .duration(200)
        .style('opacity', .9);
      
      tooltip.html(`
        <div style="color: ${colorScale[d.group]}">
          <strong>${d.name}</strong><br/>
          ${d.group === 'track' || d.group === 'artist' || d.group === 'album' ? `Popularity: ${d.popularity}<br/>` : ''}
          <div style="font-size: 12px; opacity: 0.8;">Path: ${getHierarchicalPath(d.id)}</div>
        </div>
      `);
      
      // Restart simulation in dynamic mode to create movement
      if (dynamicMode) {
        simulation.alpha(0.3).restart();
      }
    };

    const resetHighlighting = () => {
      currentHoveredNode = null;
      
      // Reset all visual enhancements
      node.selectAll('circle')
        .attr('r', (d: any) => {
          // Reset to original radius
          if (isHierarchical) {
            if (d.group === 'genre') {
              return 30 + (d.radius || 20) * 0.5;
            } else if (d.group === 'artist') {
              return Math.max(15, Math.min(30, (d.popularity || 50) / 3.3));
            } else if (d.group === 'album') {
              return Math.max(12, Math.min(25, (d.popularity || 50) / 4));
            } else {
              return Math.max(8, Math.min(15, (d.popularity || 50) / 6.7));
            }
          }
          return d.radius || 10;
        })
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.8)
        .attr('fill-opacity', 1);

      link.attr('stroke-opacity', (d) => {
        const baseOpacity = linkOpacities[d.type as keyof typeof linkOpacities] || linkOpacity;
        return baseOpacity;
      })
      .attr('stroke-width', (d) => d.strength * (isSmall ? 1.5 : 1));

      node.selectAll('text')
        .attr('opacity', (d: any) => {
          // Restore original visibility logic
          if (d.group === 'track' && (d.radius || 10) < minLabelRadius) {
            return 0;
          }
          if (d.group === 'artist' && (d.radius || 10) < minLabelRadius + 5) {
            return 0;
          }
          return 1;
        })
        .attr('font-weight', 'bold');

      tooltip.transition()
        .duration(300)
        .style('opacity', 0);
    };

    node
      .on('mouseenter', (event, d) => {
        // Clear any existing timeout
        if (hoverTimeout) {
          clearTimeout(hoverTimeout);
          hoverTimeout = null;
        }
        
        // Apply highlighting immediately
        applyHighlighting(d);
        
        // Update tooltip position
        tooltip
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px')
          .style('border-color', colorScale[d.group]);
      })
      .on('mousemove', (event, d) => {
        // Update tooltip position on mouse move
        if (currentHoveredNode === d.id) {
          tooltip
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        }
      })
      .on('mouseleave', (event, d) => {
        // Add a small delay before resetting to prevent flickering
        hoverTimeout = setTimeout(() => {
          resetHighlighting();
        }, 100);
      })
    .on('click', (event, d) => {
      if (d.spotifyUrl) {
        window.open(d.spotifyUrl, '_blank');
      }
    });

    // Set simulation nodes and links
    simulation.nodes(filteredNodes);
    (simulation.force('link') as d3.ForceLink<GraphNode, GraphLink>).links(validLinks);

    // Update positions on tick with dynamic frequency
    let tickCount = 0;
    simulation.on('tick', () => {
      tickCount++;
      
      // Update less frequently for better performance with many nodes
      if (tickCount % tickFrequency === 0) {
        link
          .attr('x1', (d: any) => d.source.x)
          .attr('y1', (d: any) => d.source.y)
          .attr('x2', (d: any) => d.target.x)
          .attr('y2', (d: any) => d.target.y);

        node
          .attr('transform', (d) => `translate(${d.x},${d.y})`);
      }
    });

    // Drag functions
    function dragstarted(event: any, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: GraphNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: GraphNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Cleanup
    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [data, width, height, viewMode, dynamicMode, linkOpacities, trackClustering, artistClustering, albumClustering, showGenres, showArtists, showAlbums, showTracks]);

  return (
    <div className="relative">
      {/* Left Panel - Controls */}
      <div className="absolute top-4 left-4 z-20 bg-gray-800 p-3 rounded-lg border border-gray-600 space-y-3">
        {/* Layer Visibility */}
        <div className="space-y-3">
          <div className="text-white text-sm font-semibold mb-2">Layer Visibility</div>
          
          <label className="flex items-center space-x-2 text-white text-sm">
            <input
              type="checkbox"
              checked={showGenres}
              onChange={(e) => setShowGenres(e.target.checked)}
              className="w-4 h-4 text-pink-600 bg-gray-700 border-gray-600 rounded focus:ring-pink-500 focus:ring-2"
            />
            <span style={{ color: '#FF10F0' }}>Genres</span>
          </label>
          
          <label className="flex items-center space-x-2 text-white text-sm">
            <input
              type="checkbox"
              checked={showArtists}
              onChange={(e) => setShowArtists(e.target.checked)}
              className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
            />
            <span style={{ color: '#A855F7' }}>Artists</span>
          </label>
          
          <label className="flex items-center space-x-2 text-white text-sm">
            <input
              type="checkbox"
              checked={showAlbums}
              onChange={(e) => setShowAlbums(e.target.checked)}
              className="w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500 focus:ring-2"
            />
            <span style={{ color: '#10FF80' }}>Albums</span>
          </label>
          
          <label className="flex items-center space-x-2 text-white text-sm">
            <input
              type="checkbox"
              checked={showTracks}
              onChange={(e) => setShowTracks(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span style={{ color: '#0080FF' }}>Tracks</span>
          </label>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-600"></div>
        
        {/* Clustering Controls */}
        <div className="space-y-3">
          <div className="text-white text-sm font-semibold mb-2">Clustering</div>
          
          <label className="flex items-center space-x-2 text-white text-sm">
            <input
              type="checkbox"
              checked={dynamicMode}
              onChange={(e) => setDynamicMode(e.target.checked)}
              className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-2"
            />
            <span>Dynamic Mode</span>
          </label>
          
          <label className="flex items-center space-x-2 text-white text-sm">
            <input
              type="checkbox"
              checked={artistClustering}
              onChange={(e) => setArtistClustering(e.target.checked)}
              className="w-4 h-4 text-cyan-600 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500 focus:ring-2"
            />
            <span>Artist Clustering</span>
          </label>
          
          <label className="flex items-center space-x-2 text-white text-sm">
            <input
              type="checkbox"
              checked={trackClustering}
              onChange={(e) => setTrackClustering(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <span>Track Clustering</span>
          </label>

          {/* Album Clustering - Only show when albums are visible */}
          {showAlbums && (
            <label className="flex items-center space-x-2 text-white text-sm">
              <input
                type="checkbox"
                checked={albumClustering}
                onChange={(e) => setAlbumClustering(e.target.checked)}
                className="w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500 focus:ring-2"
              />
              <span>Album Clustering</span>
            </label>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-gray-600"></div>
        
        {/* Clustering Opacity Controls */}
        <div className="space-y-3">
          <div className="text-white text-sm font-semibold mb-2">Link Opacity</div>
          
          {/* Artist Clustering Opacity - Only show when artist clustering is enabled */}
          {artistClustering && (
            <div className="space-y-2">
              <div className="text-white text-xs font-semibold">Artist Clustering</div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-300 w-20">Cluster↔Artist</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={linkOpacities['cluster-artist']}
                  onChange={(e) => setLinkOpacities(prev => ({...prev, 'cluster-artist': parseFloat(e.target.value)}))}
                  className="w-16 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-gray-400 w-8">{linkOpacities['cluster-artist']}</span>
              </div>
            </div>
          )}
          
          {/* Genre Clustering Opacity - Always enabled */}
          <div className="space-y-2">
            <div className="text-white text-xs font-semibold">Genre Clustering</div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-300 w-20">Genre↔Cluster</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={linkOpacities['genre-cluster']}
                onChange={(e) => setLinkOpacities(prev => ({...prev, 'genre-cluster': parseFloat(e.target.value)}))}
                className="w-16 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-400 w-8">{linkOpacities['genre-cluster']}</span>
            </div>
          </div>
          
          {/* Track Clustering Opacity - Only show when track clustering is enabled */}
          {trackClustering && (
            <div className="space-y-2">
              <div className="text-white text-xs font-semibold">Track Clustering</div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-300 w-20">Cluster↔Track</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={linkOpacities['cluster-track']}
                  onChange={(e) => setLinkOpacities(prev => ({...prev, 'cluster-track': parseFloat(e.target.value)}))}
                  className="w-16 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-gray-400 w-8">{linkOpacities['cluster-track']}</span>
              </div>
            </div>
          )}

          {/* Album Clustering Opacity - Only show when album clustering is enabled */}
          {albumClustering && showAlbums && (
            <div className="space-y-2">
              <div className="text-white text-xs font-semibold">Album Clustering</div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-300 w-20">Cluster↔Album</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={linkOpacities['cluster-album']}
                  onChange={(e) => setLinkOpacities(prev => ({...prev, 'cluster-album': parseFloat(e.target.value)}))}
                  className="w-16 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-xs text-gray-400 w-8">{linkOpacities['cluster-album']}</span>
              </div>
            </div>
          )}
        </div>
      </div>


      
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="graph-container"
        style={{ cursor: 'grab' }}
      />
    </div>
  );
};

export default ForceGraph; 